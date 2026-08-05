import { describe, expect, it, vi } from "vitest";
import { waitForServiceWorkerUpdate } from "@/lib/pwa-update";

describe("waitForServiceWorkerUpdate", () => {
  it("resolves safely when an installing worker is already installed", async () => {
    const worker = Object.assign(new EventTarget(), {
      state: "installed",
    }) as ServiceWorker;
    const registration = Object.assign(new EventTarget(), {
      installing: worker,
      waiting: null,
      update: vi.fn().mockResolvedValue(undefined),
    }) as unknown as ServiceWorkerRegistration;

    await expect(waitForServiceWorkerUpdate(registration, 50)).resolves.toBe(false);
    expect(registration.update).toHaveBeenCalledOnce();
  });
});
