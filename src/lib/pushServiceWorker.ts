/** First install precaches the app shell, so activation can outlast a few seconds. */
export const PUSH_SW_ACTIVATION_TIMEOUT_MS = 20_000;

const SKIP_WAITING = { type: "SKIP_WAITING" } as const;

/**
 * `navigator.serviceWorker.ready` only settles once a worker is active.
 * A worker stuck in installing/waiting leaves that promise pending forever,
 * which is what the push toggle was timing out on.
 */
export function waitForActivePushWorker(
  registration: ServiceWorkerRegistration,
  timeoutMs = PUSH_SW_ACTIVATION_TIMEOUT_MS,
): Promise<ServiceWorkerRegistration> {
  if (registration.active) return Promise.resolve(registration);

  return new Promise((resolve, reject) => {
    let settled = false;
    const watched = new Set<ServiceWorker>();
    let timer = 0;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      for (const worker of watched) {
        worker.removeEventListener("statechange", onState);
      }
      if (error) reject(error);
      else resolve(registration);
    };

    timer = window.setTimeout(() => {
      finish(new Error("Service worker did not become active"));
    }, timeoutMs);

    const onState = (event: Event) => {
      const worker = event.currentTarget as ServiceWorker | null;
      if (registration.active || worker?.state === "activated") {
        finish();
        return;
      }
      watch(registration.installing);
      watch(registration.waiting);
      const replacement = registration.installing ?? registration.waiting;
      if (
        worker?.state === "redundant"
        && !registration.active
        && (!replacement || replacement.state === "redundant")
      ) {
        finish(new Error("Service worker failed to install"));
        return;
      }
      nudge();
    };

    const watch = (worker: ServiceWorker | null) => {
      if (!worker || watched.has(worker)) return;
      watched.add(worker);
      worker.addEventListener("statechange", onState);
    };

    let nudged = false;
    const nudge = () => {
      if (nudged || registration.active) return;
      const worker = registration.waiting ?? registration.installing;
      if (!worker || worker.state === "redundant") return;
      nudged = true;
      worker.postMessage(SKIP_WAITING);
    };

    watch(registration.installing);
    watch(registration.waiting);
    nudge();
  });
}

export async function ensurePushServiceWorker(
  timeoutMs = PUSH_SW_ACTIVATION_TIMEOUT_MS,
): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing?.active) return existing;

  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  if (registration.active) return registration;
  return waitForActivePushWorker(registration, timeoutMs);
}
