import { describe, expect, it, vi } from "vitest";
import { waitForActivePushWorker } from "@/lib/pushServiceWorker";

function fakeWorker(state: ServiceWorkerState) {
  const worker = new EventTarget() as ServiceWorker;
  Object.defineProperty(worker, "state", { configurable: true, value: state });
  Object.defineProperty(worker, "postMessage", {
    configurable: true,
    value: vi.fn(),
    writable: true,
  });
  return worker;
}

const setWorkerState = (worker: ServiceWorker, state: ServiceWorkerState) =>
  Object.defineProperty(worker, "state", { configurable: true, value: state });

const setRegistrationWorker = (
  registration: ServiceWorkerRegistration,
  key: "active" | "installing" | "waiting",
  worker: ServiceWorker | null,
) => Object.defineProperty(registration, key, { configurable: true, value: worker });

function fakeRegistration(partial: {
  active?: ServiceWorker | null;
  installing?: ServiceWorker | null;
  waiting?: ServiceWorker | null;
}) {
  return {
    active: partial.active ?? null,
    installing: partial.installing ?? null,
    waiting: partial.waiting ?? null,
  } as ServiceWorkerRegistration;
}

describe("waitForActivePushWorker", () => {
  it("uses an active worker without asking it to skip waiting", async () => {
    const active = fakeWorker("activated");
    const registration = fakeRegistration({ active });

    await expect(waitForActivePushWorker(registration, 50)).resolves.toBe(registration);
    expect(active.postMessage).not.toHaveBeenCalled();
  });

  it("asks a waiting worker to activate", async () => {
    const waiting = fakeWorker("installed");
    const registration = fakeRegistration({ waiting });
    waiting.postMessage = vi.fn(() => {
      setWorkerState(waiting, "activated");
      setRegistrationWorker(registration, "active", waiting);
      waiting.dispatchEvent(new Event("statechange"));
    });

    await expect(waitForActivePushWorker(registration, 50)).resolves.toBe(registration);
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });

  it("fails when installation is discarded", async () => {
    const installing = fakeWorker("installing");
    const registration = fakeRegistration({ installing });
    const pending = waitForActivePushWorker(registration, 50);

    setWorkerState(installing, "redundant");
    setRegistrationWorker(registration, "installing", null);
    installing.dispatchEvent(new Event("statechange"));

    await expect(pending).rejects.toThrow(/failed to install/i);
  });

  it("stops waiting when the worker never activates", async () => {
    const installing = fakeWorker("installing");
    const registration = fakeRegistration({ installing });

    await expect(waitForActivePushWorker(registration, 20)).rejects.toThrow(
      /did not become active/i,
    );
  });
});
