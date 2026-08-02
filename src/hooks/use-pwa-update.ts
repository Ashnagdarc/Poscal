import { useCallback, useEffect, useRef, useState } from "react";
import {
  PENDING_UPDATE_KEY,
  UPDATE_EVENT_NAME,
  notifyPwaUpdateAvailable,
  waitForServiceWorkerUpdate,
  type PWAUpdateEventDetail,
} from "@/lib/pwa-update";

export const usePWAUpdate = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const isUpdatingRef = useRef(false);

  const showUpdate = useCallback((registration: ServiceWorkerRegistration | null | undefined) => {
    if (!registration?.waiting) return false;

    registrationRef.current = registration;
    notifyPwaUpdateAvailable(registration);
    setUpdateAvailable(true);
    return true;
  }, []);

  const clearPendingUpdate = useCallback(() => {
    registrationRef.current = null;
    localStorage.removeItem(PENDING_UPDATE_KEY);
    setUpdateAvailable(false);
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleUpdateAvailable = (event: Event) => {
      const detail = (event as CustomEvent<PWAUpdateEventDetail>).detail;
      if (!detail?.registration?.waiting) return;
      registrationRef.current = detail.registration;
      localStorage.setItem(PENDING_UPDATE_KEY, "true");
      setUpdateAvailable(true);
    };

    const handleControllerChange = () => {
      if (!isUpdatingRef.current) return;

      localStorage.removeItem(PENDING_UPDATE_KEY);
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
        if (localStorage.getItem(PENDING_UPDATE_KEY) !== "true") {
          setUpdateAvailable(false);
        }
      })
      .catch(() => {
        setUpdateAvailable(false);
      });

    return () => {
      window.removeEventListener(UPDATE_EVENT_NAME, handleUpdateAvailable);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, [showUpdate]);

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
          clearPendingUpdate();
        }
      } catch {
        clearPendingUpdate();
      }
    };

    void verifyPendingUpdate();
  }, [clearPendingUpdate, showUpdate]);

  const updateApp = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return;

    setIsUpdating(true);
    isUpdatingRef.current = true;

    const registration = registrationRef.current ?? (await navigator.serviceWorker.getRegistration("/"));
    const waitingWorker = registration?.waiting;

    if (!waitingWorker) {
      // Force a hard reload if the worker already activated but UI is stale.
      clearPendingUpdate();
      window.location.reload();
      return;
    }

    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  }, [clearPendingUpdate]);

  const checkForUpdate = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return false;

    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      if (!registration) return false;

      if (showUpdate(registration)) return true;

      const found = await waitForServiceWorkerUpdate(registration);
      return found ? showUpdate(registration) : false;
    } catch {
      return false;
    }
  }, [showUpdate]);

  return {
    updateAvailable,
    isUpdating,
    updateApp,
    checkForUpdate,
  };
};
