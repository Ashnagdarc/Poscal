export const UPDATE_EVENT_NAME = "poscal:pwa-update-available";
export const PENDING_UPDATE_KEY = "poscal-pwa-pending-update";

export interface PWAUpdateEventDetail {
  registration: ServiceWorkerRegistration;
}

/** Mark a waiting/installing worker as an available update and notify UI listeners. */
export const notifyPwaUpdateAvailable = (
  registration: ServiceWorkerRegistration | null | undefined,
): boolean => {
  if (typeof window === "undefined" || !registration) return false;
  // Prefer waiting; installing is also a signal (about to wait after install).
  if (!registration.waiting && !registration.installing) return false;

  try {
    localStorage.setItem(PENDING_UPDATE_KEY, "true");
  } catch {
    // ignore
  }
  window.dispatchEvent(
    new CustomEvent<PWAUpdateEventDetail>(UPDATE_EVENT_NAME, {
      detail: { registration },
    }),
  );
  return true;
};

/**
 * Run a service-worker update check and wait until a waiting worker appears
 * (or the check finishes with nothing new). `registration.update()` alone often
 * resolves before `installing` becomes `waiting`.
 */
export const waitForServiceWorkerUpdate = async (
  registration: ServiceWorkerRegistration,
  timeoutMs = 12_000,
): Promise<boolean> => {
  if (registration.waiting) return true;

  return new Promise<boolean>((resolve) => {
    let settled = false;

    const finish = (found: boolean) => {
      if (settled) return;
      settled = true;
      registration.removeEventListener("updatefound", onUpdateFound);
      window.clearTimeout(timeoutId);
      resolve(found);
    };

    const watchWorker = (worker: ServiceWorker | null) => {
      if (!worker) return;

      if (worker.state === "installed") {
        finish(Boolean(registration.waiting));
        return;
      }

      if (worker.state === "redundant") {
        finish(Boolean(registration.waiting));
        return;
      }

      worker.addEventListener("statechange", () => {
        if (worker.state === "installed") {
          finish(Boolean(registration.waiting));
        } else if (worker.state === "redundant") {
          finish(Boolean(registration.waiting));
        } else if (worker.state === "activated") {
          // Activated without waiting — first install or auto skipWaiting.
          finish(false);
        }
      });
    };

    const onUpdateFound = () => {
      watchWorker(registration.installing);
    };

    registration.addEventListener("updatefound", onUpdateFound);
    watchWorker(registration.installing);

    const timeoutId = window.setTimeout(() => {
      finish(Boolean(registration.waiting));
    }, timeoutMs);

    void registration
      .update()
      .then(() => {
        if (registration.waiting) {
          finish(true);
          return;
        }
        if (registration.installing) {
          watchWorker(registration.installing);
          return;
        }
        // No update found; give updatefound a brief moment, then settle via timeout.
      })
      .catch(() => {
        finish(Boolean(registration.waiting));
      });
  });
};
