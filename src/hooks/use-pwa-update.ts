import { useCallback, useEffect, useRef, useState } from "react";
import {
  BUILD_MISMATCH_EVENT,
  STALE_BUILD_KEY,
  clearBuildMismatchFlag,
  dismissUpdateForCurrentBuild,
  forceAppRefresh,
  isClientBuildStale,
  isUpdateDismissedForCurrentBuild,
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
const VERSION_POLL_MS = 90_000;
const VERSION_CHECK_DEBOUNCE_MS = 5_000;

export const usePWAUpdate = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const hadControllerRef = useRef(
    typeof navigator !== "undefined" && "serviceWorker" in navigator
      ? Boolean(navigator.serviceWorker.controller)
      : false,
  );
  /** Only auto-reload on controllerchange when the user clicked Update. */
  const userRequestedUpdateRef = useRef(false);
  const versionCheckInFlight = useRef(false);
  const lastVersionCheckAt = useRef(0);

  const markUpdateAvailable = useCallback(() => {
    if (isUpdateDismissedForCurrentBuild()) return;
    setUpdateAvailable(true);
  }, []);

  const hideUpdate = useCallback(() => {
    registrationRef.current = null;
    try {
      localStorage.removeItem(PENDING_UPDATE_KEY);
    } catch {
      // ignore
    }
    clearBuildMismatchFlag();
    dismissUpdateForCurrentBuild();
    setUpdateAvailable(false);
  }, []);

  const showUpdate = useCallback((registration: ServiceWorkerRegistration | null | undefined) => {
    if (!registration?.waiting) return false;

    registrationRef.current = registration;
    notifyPwaUpdateAvailable(registration);
    markUpdateAvailable();
    return true;
  }, [markUpdateAvailable]);

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
        // Real new entry on CDN — ignore session dismiss for that older entry.
        notifyBuildMismatch();
        if (!isUpdateDismissedForCurrentBuild()) {
          setUpdateAvailable(true);
        }
        return true;
      }

      // Fresh enough — never keep a leftover banner.
      clearBuildMismatchFlag();
      try {
        localStorage.removeItem(PENDING_UPDATE_KEY);
      } catch {
        // ignore
      }
      setUpdateAvailable(false);
      return false;
    } catch {
      return false;
    } finally {
      versionCheckInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
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

    const handleControllerChange = () => {
      if (!hadControllerRef.current) {
        hadControllerRef.current = true;
        return;
      }
      // Auto skipWaiting used to force reload on every SW_ACTIVATED and trap
      // users in a refresh/banner loop. Only reload after explicit "Update now".
      if (userRequestedUpdateRef.current) {
        userRequestedUpdateRef.current = false;
        void forceAppRefresh();
      }
    };

    window.addEventListener(UPDATE_EVENT_NAME, handleUpdateAvailable);
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    navigator.serviceWorker.ready
      .then(async (registration) => {
        if (registration.waiting) {
          showUpdate(registration);
          return;
        }
        // Never trust leftover flags alone — re-verify against the CDN.
        if (
          localStorage.getItem(PENDING_UPDATE_KEY) === "true"
          || localStorage.getItem(STALE_BUILD_KEY) === "true"
        ) {
          const stillStale = await isClientBuildStale();
          if (stillStale) {
            markUpdateAvailable();
          } else {
            hideUpdate();
          }
        }
      })
      .catch(() => {
        // ignore
      });

    return () => {
      window.removeEventListener(UPDATE_EVENT_NAME, handleUpdateAvailable);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, [hideUpdate, markUpdateAvailable, showUpdate]);

  useEffect(() => {
    const onBuildMismatch = () => markUpdateAvailable();
    window.addEventListener(BUILD_MISMATCH_EVENT, onBuildMismatch);

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
        if (found && showUpdate(registration)) return;

        const stale = await isClientBuildStale();
        if (stale) {
          markUpdateAvailable();
          return;
        }
        hideUpdate();
      } catch {
        void checkBuildVersion();
      }
    };

    void verifyPendingUpdate();
  }, [checkBuildVersion, hideUpdate, markUpdateAvailable, showUpdate]);

  const updateApp = useCallback(async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    userRequestedUpdateRef.current = true;

    // Hide immediately — clicking Update should not leave a ghost banner after reload.
    hideUpdate();

    const stuckTimer = window.setTimeout(() => {
      setIsUpdating(false);
      try {
        window.location.reload();
      } catch {
        // ignore
      }
    }, 6_000);

    try {
      const registration =
        registrationRef.current
        ?? ("serviceWorker" in navigator
          ? (await navigator.serviceWorker.getRegistration("/")) ?? null
          : null);

      if (registration?.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }

      await forceAppRefresh();
    } catch {
      try {
        window.location.href = "/";
      } catch {
        // ignore
      }
      setIsUpdating(false);
      window.clearTimeout(stuckTimer);
    }
  }, [hideUpdate, isUpdating]);

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
