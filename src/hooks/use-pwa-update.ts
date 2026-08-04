import { useCallback, useEffect, useRef, useState } from "react";
import {
  BUILD_MISMATCH_EVENT,
  STALE_BUILD_KEY,
  clearBuildMismatchFlag,
  forceAppRefresh,
  isClientBuildStale,
  notifyBuildMismatch,
} from "@/lib/appVersion";
import {
  PENDING_UPDATE_KEY,
  UPDATE_EVENT_NAME,
  notifyPwaUpdateAvailable,
  waitForServiceWorkerUpdate,
  type PWAUpdateEventDetail,
} from "@/lib/pwa-update";

/** How often to probe the CDN for a newer index (focused tab only). */
const VERSION_POLL_MS = 60_000;
const VERSION_CHECK_DEBOUNCE_MS = 2_500;

export const usePWAUpdate = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const hadControllerRef = useRef(
    typeof navigator !== "undefined" && "serviceWorker" in navigator
      ? Boolean(navigator.serviceWorker.controller)
      : false,
  );
  const userRequestedUpdateRef = useRef(false);
  const versionCheckInFlight = useRef(false);
  const lastVersionCheckAt = useRef(0);

  const markUpdateAvailable = useCallback(() => {
    setUpdateAvailable(true);
  }, []);

  const showUpdate = useCallback((registration: ServiceWorkerRegistration | null | undefined) => {
    if (!registration?.waiting) return false;

    registrationRef.current = registration;
    notifyPwaUpdateAvailable(registration);
    markUpdateAvailable();
    return true;
  }, [markUpdateAvailable]);

  const clearPendingUpdate = useCallback(() => {
    registrationRef.current = null;
    try {
      localStorage.removeItem(PENDING_UPDATE_KEY);
    } catch {
      // ignore
    }
    clearBuildMismatchFlag();
    setUpdateAvailable(false);
  }, []);

  const checkBuildVersion = useCallback(async () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return false;
    }

    const now = Date.now();
    if (versionCheckInFlight.current) return false;
    if (now - lastVersionCheckAt.current < VERSION_CHECK_DEBOUNCE_MS) return false;

    versionCheckInFlight.current = true;
    lastVersionCheckAt.current = now;

    try {
      const stale = await isClientBuildStale();
      if (stale) {
        notifyBuildMismatch();
        markUpdateAvailable();
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      versionCheckInFlight.current = false;
    }
  }, [markUpdateAvailable]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      // Still version-check non-SW clients (desktop browser without SW).
      return;
    }

    const handleUpdateAvailable = (event: Event) => {
      const detail = (event as CustomEvent<PWAUpdateEventDetail>).detail;
      if (!detail?.registration?.waiting) return;
      registrationRef.current = detail.registration;
      try {
        localStorage.setItem(PENDING_UPDATE_KEY, "true");
      } catch {
        // ignore
      }
      markUpdateAvailable();
    };

    // Reload only after the user asked to update (skipWaiting → new controller).
    // Do not also reload on SW_ACTIVATED + navigate races (that caused ERR_FAILED).
    const handleControllerChange = () => {
      if (!hadControllerRef.current) {
        hadControllerRef.current = true;
        return;
      }
      if (!userRequestedUpdateRef.current) {
        // New SW claimed without explicit update click — surface the banner instead
        // of force-navigating (avoids mid-session hard reload loops).
        markUpdateAvailable();
        return;
      }
      userRequestedUpdateRef.current = false;
      window.location.reload();
    };

    window.addEventListener(UPDATE_EVENT_NAME, handleUpdateAvailable);
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    navigator.serviceWorker.ready
      .then((registration) => {
        if (registration.waiting) {
          showUpdate(registration);
          return;
        }
        if (
          localStorage.getItem(PENDING_UPDATE_KEY) === "true"
          || localStorage.getItem(STALE_BUILD_KEY) === "true"
        ) {
          markUpdateAvailable();
        }
      })
      .catch(() => {
        // ignore
      });

    return () => {
      window.removeEventListener(UPDATE_EVENT_NAME, handleUpdateAvailable);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, [markUpdateAvailable, showUpdate]);

  useEffect(() => {
    const onBuildMismatch = () => markUpdateAvailable();
    window.addEventListener(BUILD_MISMATCH_EVENT, onBuildMismatch);

    if (localStorage.getItem(STALE_BUILD_KEY) === "true") {
      markUpdateAvailable();
    }

    // Immediate + periodic probe so users see deploys without logging out.
    void checkBuildVersion();
    const intervalId = window.setInterval(() => {
      void checkBuildVersion();
    }, VERSION_POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void checkBuildVersion();
      }
    };
    const onFocus = () => void checkBuildVersion();
    const onOnline = () => void checkBuildVersion();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);

    return () => {
      window.removeEventListener(BUILD_MISMATCH_EVENT, onBuildMismatch);
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
    };
  }, [checkBuildVersion, markUpdateAvailable]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const verifyPendingUpdate = async () => {
      const hasPendingUpdate = localStorage.getItem(PENDING_UPDATE_KEY) === "true";
      if (!hasPendingUpdate) return;

      try {
        const registration =
          (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.ready);

        if (showUpdate(registration)) return;

        const found = await waitForServiceWorkerUpdate(registration);
        if (!found || !showUpdate(registration)) {
          // Pending SW flag may be stale — still check CDN version.
          const stale = await checkBuildVersion();
          if (!stale) {
            try {
              localStorage.removeItem(PENDING_UPDATE_KEY);
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // keep banner if build is stale
        void checkBuildVersion();
      }
    };

    void verifyPendingUpdate();
  }, [checkBuildVersion, showUpdate]);

  const updateApp = useCallback(async () => {
    setIsUpdating(true);
    userRequestedUpdateRef.current = true;
    await forceAppRefresh();
  }, []);

  const checkForUpdate = useCallback(async () => {
    let found = false;

    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration("/");
        if (registration) {
          if (showUpdate(registration)) {
            found = true;
          } else {
            const waiting = await waitForServiceWorkerUpdate(registration);
            if (waiting && showUpdate(registration)) {
              found = true;
            }
          }
        }
      } catch {
        // fall through to version check
      }
    }

    const stale = await checkBuildVersion();
    return found || stale || updateAvailable;
  }, [checkBuildVersion, showUpdate, updateAvailable]);

  return {
    updateAvailable,
    isUpdating,
    updateApp,
    checkForUpdate,
  };
};
