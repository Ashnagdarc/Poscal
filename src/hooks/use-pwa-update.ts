import { useCallback, useEffect, useRef, useState } from "react";

const UPDATE_EVENT_NAME = "poscal:pwa-update-available";
const PENDING_UPDATE_KEY = "poscal-pwa-pending-update";

interface PWAUpdateEventDetail {
  registration: ServiceWorkerRegistration;
}

export const usePWAUpdate = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const isUpdatingRef = useRef(false);

  const showUpdate = useCallback((registration: ServiceWorkerRegistration | null | undefined) => {
    if (!registration?.waiting) return false;

    registrationRef.current = registration;
    localStorage.setItem(PENDING_UPDATE_KEY, "true");
    setUpdateAvailable(true);
    return true;
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleUpdateAvailable = (event: Event) => {
      const detail = (event as CustomEvent<PWAUpdateEventDetail>).detail;
      showUpdate(detail?.registration);
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
        const hasPendingUpdate = localStorage.getItem(PENDING_UPDATE_KEY) === "true";
        if (registration.waiting) {
          showUpdate(registration);
        } else if (!hasPendingUpdate) {
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

  const updateApp = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return;

    setIsUpdating(true);
    isUpdatingRef.current = true;

    const registration = registrationRef.current ?? await navigator.serviceWorker.getRegistration("/");
    const waitingWorker = registration?.waiting;

    if (!waitingWorker) {
      localStorage.removeItem(PENDING_UPDATE_KEY);
      window.location.reload();
      return;
    }

    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  }, []);

  return {
    updateAvailable,
    isUpdating,
    updateApp,
  };
};
