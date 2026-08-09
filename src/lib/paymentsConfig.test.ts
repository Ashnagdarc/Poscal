import { afterEach, describe, expect, it, vi } from "vitest";

describe("isPaymentsEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("defaults to disabled when env is unset", async () => {
    vi.stubEnv("VITE_PAYMENTS_ENABLED", undefined as unknown as string);
    const { isPaymentsEnabled } = await import("./paymentsConfig");
    expect(isPaymentsEnabled()).toBe(false);
  });

  it("enables when VITE_PAYMENTS_ENABLED is true", async () => {
    vi.stubEnv("VITE_PAYMENTS_ENABLED", "true");
    const { isPaymentsEnabled } = await import("./paymentsConfig");
    expect(isPaymentsEnabled()).toBe(true);
  });
});
