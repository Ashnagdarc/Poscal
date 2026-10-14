// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

afterEach(() => {
  vi.useRealTimers();
});

describe("auth email rate limiting", () => {
  it("allows the first send and refuses an immediate resend", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T12:00:00Z"));
    const t = convexTest(schema, modules);

    const first = await t.mutation(internal.authRateLimit.consumeEmailSend, {
      kind: "verification",
      email: "Trader@Example.com",
    });
    const immediate = await t.mutation(internal.authRateLimit.consumeEmailSend, {
      kind: "verification",
      email: "trader@example.com",
    });

    expect(first).toMatchObject({ ok: true, reason: "allowed" });
    expect(immediate).toMatchObject({ ok: false, reason: "cooldown" });
  });

  it("keeps the existing auth-attempt limiter available", async () => {
    const t = convexTest(schema, modules);
    const first = await t.mutation(internal.authRateLimit.consume, {
      action: "signIn",
      email: "trader@example.com",
    });
    expect(first).toMatchObject({ ok: true, remaining: 9 });

    await expect(t.mutation(internal.authRateLimit.reset, {
      action: "signIn",
      email: "trader@example.com",
    })).resolves.toEqual({ ok: true });
  });

  it("does not treat an already verified address as sendable", async () => {
    const t = convexTest(schema, modules);
    await t.run((ctx) => ctx.db.insert("users", {
      email: "verified@example.com",
      name: "Verified Trader",
      emailVerificationTime: Date.now(),
    }));

    await expect(t.query(internal.authRateLimit.verificationRecipient, {
      email: "verified@example.com",
    })).resolves.toEqual({
      alreadyVerified: true,
      name: "Verified Trader",
    });
  });
});
