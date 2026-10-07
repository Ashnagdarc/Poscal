// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";
import { createHmac } from "node:crypto";
import { api, internal } from "./_generated/api";
import {
  PRO_LOCK_KEY,
  addPlanPeriod,
  PRICES,
  safeReturnTo,
  verifyTransactionMatch,
} from "../shared/proPolicy";

const modules = import.meta.glob("./**/*.ts");
const setup = async (enabled = true) => {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "trader@example.com",
      emailVerificationTime: Date.now(),
    }),
  );
  const user = t.withIdentity({ subject: `${userId}|session` });
  if (enabled)
    await t.run((ctx) =>
      ctx.db.insert("appSettings", {
        key: PRO_LOCK_KEY,
        valueBoolean: true,
        updatedAtMs: Date.now(),
      }),
    );
  return { t, user, userId };
};
const prepare = (
  user: Awaited<ReturnType<typeof setup>>["user"],
  code?: string,
) =>
  user.mutation(internal.proBilling.prepareOrder, {
    plan: "monthly",
    reminders: false,
    returnTo: "/journal?tab=notebook",
    code,
  });
const verified = (order: {
  _id: string;
  reference: string;
  amount: number;
}) => ({
  status: "success",
  reference: order.reference,
  amount: order.amount,
  currency: "NGN",
  domain: "test",
  id: 1234,
  metadata: { orderId: order._id },
  paid_at: new Date().toISOString(),
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_test_fixture");
  vi.stubEnv("PRO_PAYMENT_MODE", "test");
  vi.stubEnv("PRO_APP_ORIGIN", "https://poscal-preview.vercel.app");
  vi.stubEnv("RESEND_API_KEY", "fixture");
  vi.stubEnv("VAPID_PUBLIC_KEY", "fixture");
  vi.stubEnv("VAPID_PRIVATE_KEY", "fixture");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Pro payment ledger", () => {
  it("defaults to open beta and ignores the old paid-lock setting", async () => {
    const { t, user } = await setup(false);
    await t.run((ctx) =>
      ctx.db.insert("appSettings", {
        key: "signals_paid_lock_enabled",
        valueBoolean: true,
        updatedAtMs: Date.now(),
      }),
    );
    expect(await user.query(api.proBilling.entitlements, {})).toMatchObject({
      beta: true,
      pro: true,
      paid: false,
    });
    await expect(prepare(user)).rejects.toThrow("Payments are switched off");
  });
  it("serializes duplicate checkout requests into one order and one initialization", async () => {
    const { t, user } = await setup();
    const [a, b] = await Promise.all([prepare(user), prepare(user)]);
    expect(a.order.reference).toBe(b.order.reference);
    expect([a.initialize, b.initialize].filter(Boolean)).toHaveLength(1);
    expect(
      await t.run((ctx) => ctx.db.query("proOrders").collect()),
    ).toHaveLength(1);
  });
  it("initializes with the documented reference, amount and metadata contract without granting access", async () => {
    const { t, user } = await setup();
    const request = vi
      .fn()
      .mockImplementation((_url: string, options: RequestInit) => {
        const body = JSON.parse(options.body as string);
        expect(body.reference).toMatch(/^ppro-[A-Za-z0-9.=-]+$/);
        expect(body.amount).toBe("250000");
        expect(JSON.parse(body.metadata)).toMatchObject({
          product: "poscal_pro",
          policyVersion: 1,
        });
        return Promise.resolve(
          new Response(
            JSON.stringify({
              status: true,
              data: {
                reference: body.reference,
                access_code: "fixturecode",
                authorization_url: "https://checkout.paystack.com/fixturecode",
              },
            }),
            { status: 200 },
          ),
        );
      });
    vi.stubGlobal("fetch", request);
    const args = {
      plan: "monthly" as const,
      reminders: false,
      returnTo: "/journal",
    };
    const references = await Promise.all([
      user.action(api.proPayments.startCheckout, args),
      user.action(api.proPayments.startCheckout, args),
    ]);
    expect(references[0]).toBe(references[1]);
    expect(request).toHaveBeenCalledTimes(1);
    expect((await user.query(api.proBilling.currentOrder, {}))!.status).toBe(
      "pending",
    );
    expect((await user.query(api.proBilling.entitlements, {}))!.paid).toBe(
      false,
    );
    expect(
      await t.run((ctx) => ctx.db.query("proOrders").collect()),
    ).toHaveLength(1);
  });
  it("commits verified access once even if callbacks/webhooks repeat", async () => {
    const { t, user } = await setup();
    const { order } = await prepare(user);
    await t.mutation(internal.proBilling.recordVerification, {
      id: order._id,
      transaction: verified(order),
      mode: "test",
    });
    const first = await user.query(api.proBilling.entitlements, {});
    await t.mutation(internal.proBilling.recordVerification, {
      id: order._id,
      transaction: verified(order),
      mode: "test",
    });
    const second = await user.query(api.proBilling.entitlements, {});
    expect(first!.paid).toBe(true);
    expect(second!.expiresAtMs).toBe(first!.expiresAtMs);
    expect(
      await t.run((ctx) => ctx.db.query("notificationQueue").collect()),
    ).toHaveLength(1);
    expect(
      await user.query(api.proBilling.currentOrder, {
        reference: order.reference,
      }),
    ).toMatchObject({ status: "paid", returnTo: "/journal?tab=notebook" });
  });
  it.each([
    { amount: 1 },
    { currency: "USD" },
    { reference: "some-other-payment" },
    { domain: "live" },
    { metadata: { orderId: "another-order" } },
  ])("does not activate on a mismatched success: %j", async (mismatch) => {
    const { t, user } = await setup();
    const { order } = await prepare(user);
    await t.mutation(internal.proBilling.recordVerification, {
      id: order._id,
      transaction: { ...verified(order), ...mismatch },
      mode: "test",
    });
    expect(await user.query(api.proBilling.entitlements, {})).toMatchObject({
      paid: false,
    });
    expect(await user.query(api.proBilling.currentOrder, {})).toMatchObject({
      status: "review",
    });
  });
  it("does not activate on failed, pending or a provider timeout", async () => {
    for (const status of ["failed", "pending", "processing"]) {
      const { t, user } = await setup();
      const { order } = await prepare(user);
      await t.mutation(internal.proBilling.recordVerification, {
        id: order._id,
        transaction: { ...verified(order), status },
        mode: "test",
      });
      expect((await user.query(api.proBilling.entitlements, {}))!.paid).toBe(
        false,
      );
    }
    const { t, user } = await setup();
    const { order } = await prepare(user);
    await t.mutation(internal.proBilling.recordVerification, {
      id: order._id,
      transaction: null,
      mode: "test",
      error: "timeout",
    });
    expect((await user.query(api.proBilling.currentOrder, {}))!.status).toBe(
      "initializing",
    );
    expect((await prepare(user)).order.reference).toBe(order.reference);
  });
  it("recovers payment success after the browser or backend missed the callback", async () => {
    const { t, user } = await setup();
    const { order } = await prepare(user);
    await t.mutation(internal.proBilling.initialized, { id: order._id });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              status: true,
              data: url.includes("/transaction/verify/") ? verified(order) : [],
            }),
            { status: 200 },
          ),
        ),
      ),
    );
    await user.action(api.proPayments.checkPayment, {
      reference: order.reference,
    });
    expect((await user.query(api.proBilling.entitlements, {}))!.paid).toBe(
      true,
    );
  });
  it("checks ownership and admin role before payment verification", async () => {
    const { t, user } = await setup();
    const { order } = await prepare(user);
    const otherId = await t.run((ctx) =>
      ctx.db.insert("users", { email: "other@example.com" }),
    );
    const other = t.withIdentity({ subject: `${otherId}|session` });
    await expect(
      other.action(api.proPayments.checkPayment, {
        reference: order.reference,
      }),
    ).rejects.toThrow("Payment not found");
    await expect(
      other.action(api.proPayments.checkPayment, {
        reference: order.reference,
        admin: true,
      }),
    ).rejects.toThrow("Admin access");
  });
  it("a signed duplicate webhook has only one durable inbox entry", async () => {
    const { t, user } = await setup();
    const { order } = await prepare(user);
    await t.mutation(internal.proBilling.captureWebhook, {
      digest: "same-body",
      event: "charge.success",
      reference: order.reference,
    });
    await t.mutation(internal.proBilling.captureWebhook, {
      digest: "same-body",
      event: "charge.success",
      reference: order.reference,
    });
    expect(
      await t.run((ctx) => ctx.db.query("proWebhookEvents").collect()),
    ).toHaveLength(1);
  });
  it("a reversal withdraws access rather than trusting a saved success", async () => {
    const { t, user } = await setup();
    const { order } = await prepare(user);
    await t.mutation(internal.proBilling.recordVerification, {
      id: order._id,
      transaction: verified(order),
      mode: "test",
    });
    await t.mutation(internal.proBilling.recordVerification, {
      id: order._id,
      transaction: { ...verified(order), status: "reversed" },
      mode: "test",
    });
    expect((await user.query(api.proBilling.entitlements, {}))!.paid).toBe(
      false,
    );
    expect(
      await user.query(api.proBilling.currentOrder, {
        reference: order.reference,
      }),
    ).toMatchObject({ status: "reversed" });
  });
  it("refund/dispute quarantine cannot be bypassed by an ordinary success recheck", async () => {
    const { t, user } = await setup();
    const { order } = await prepare(user);
    await t.mutation(internal.proBilling.recordVerification, {
      id: order._id,
      transaction: verified(order),
      mode: "test",
    });
    await t.mutation(internal.proBilling.captureWebhook, {
      digest: "refund",
      event: "refund.processed",
      reference: order.reference,
    });
    await t.mutation(internal.proBilling.recordVerification, {
      id: order._id,
      transaction: verified(order),
      mode: "test",
    });
    expect((await user.query(api.proBilling.entitlements, {}))!.paid).toBe(
      false,
    );
  });
  it("preserves a signed refund hold through a verification outage", async () => {
    const { t, user } = await setup();
    const { order } = await prepare(user);
    await t.mutation(internal.proBilling.recordVerification, {
      id: order._id,
      transaction: verified(order),
      mode: "test",
    });
    await t.mutation(internal.proBilling.captureWebhook, {
      digest: "refund-outage",
      event: "refund.processed",
      reference: order.reference,
    });
    await t.mutation(internal.proBilling.recordVerification, {
      id: order._id,
      transaction: null,
      mode: "test",
      error: "timeout",
    });
    expect(
      (await user.query(api.proBilling.currentOrder, {
        reference: order.reference,
      }))!.reviewReason,
    ).toMatch(/^refund\./);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              status: true,
              data: url.includes("/transaction/verify/") ? verified(order) : [],
            }),
            { status: 200 },
          ),
        ),
      ),
    );
    await user.action(api.proPayments.checkPayment, {
      reference: order.reference,
    });
    expect((await user.query(api.proBilling.entitlements, {}))!.paid).toBe(
      false,
    );
  });
  it("allows retry only when an undelivered checkout is confirmed missing by the provider", async () => {
    const { t, user } = await setup();
    const { order } = await prepare(user);
    await t.mutation(internal.proBilling.initialized, { id: order._id });
    vi.setSystemTime(Date.now() + 3 * 60_000);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 404 })),
    );
    await user.action(api.proPayments.checkPayment, {
      reference: order.reference,
    });
    expect((await user.query(api.proBilling.currentOrder, {}))!.status).toBe(
      "abandoned",
    );
    expect((await prepare(user)).order.reference).not.toBe(order.reference);
  });
  it("does not let a stale financial check clear a newer signed dispute", async () => {
    const { t, user } = await setup();
    const { order } = await prepare(user);
    await t.mutation(internal.proBilling.recordVerification, {
      id: order._id,
      transaction: verified(order),
      mode: "test",
    });
    const expiry = (await user.query(api.proBilling.entitlements, {}))!
      .expiresAtMs;
    await t.mutation(internal.proBilling.captureWebhook, {
      digest: "new-dispute",
      event: "charge.dispute.create",
      reference: order.reference,
    });
    await t.mutation(internal.proBilling.recordVerification, {
      id: order._id,
      transaction: verified(order),
      mode: "test",
      financialChecked: true,
    });
    expect((await user.query(api.proBilling.entitlements, {}))!.paid).toBe(
      false,
    );
    await t.mutation(internal.proBilling.recordVerification, {
      id: order._id,
      transaction: verified(order),
      mode: "test",
      financialChecked: true,
      financialHoldDigest: "new-dispute",
    });
    expect(
      (await user.query(api.proBilling.entitlements, {}))!.expiresAtMs,
    ).toBe(expiry);
    expect((await user.query(api.proBilling.entitlements, {}))!.paid).toBe(
      true,
    );
  });
  it("suppress stale pending notifications after verified activation", async () => {
    const { t, user } = await setup();
    const { order } = await prepare(user);
    await t.mutation(internal.proBilling.recordVerification, {
      id: order._id,
      transaction: verified(order),
      mode: "test",
    });
    expect(
      await t.query(internal.proBilling.notificationStillRelevant, {
        id: order._id,
        kind: "pending",
      }),
    ).toBe(false);
    expect(
      await t.query(internal.proBilling.notificationStillRelevant, {
        id: order._id,
        kind: "paid",
      }),
    ).toBe(true);
  });
});

describe("discounts, renewals and authentication", () => {
  it("holds the final discount slot atomically across two customers", async () => {
    const { t, user, userId } = await setup();
    await t.run((ctx) => ctx.db.patch(userId, { role: "admin" }));
    await user.mutation(api.proBilling.createCoupon, {
      code: "EARLYBIRD",
      percentOff: 20,
      maxUses: 1,
      validUntilMs: Date.now() + 86400000,
      firstPurchaseOnly: true,
      betaUsersOnly: false,
    });
    const otherId = await t.run((ctx) =>
      ctx.db.insert("users", { email: "second@example.com" }),
    );
    const other = t.withIdentity({ subject: `${otherId}|session` });
    const results = await Promise.allSettled([
      prepare(user, "earlybird"),
      prepare(other, "EARLYBIRD"),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const winner = results.find((result) => result.status === "fulfilled");
    if (winner?.status !== "fulfilled") throw new Error("Missing winner");
    expect(winner.value.order.amount).toBe(200000);
    const coupon = await t.run((ctx) => ctx.db.query("proCoupons").first());
    expect(coupon?.reservedUses).toBe(1);
  });
  it("does not release another checkout’s discount reservation on repeated terminal transitions", async () => {
    const { t, user, userId } = await setup();
    await t.run((ctx) => ctx.db.patch(userId, { role: "admin" }));
    const couponId = await user.mutation(api.proBilling.createCoupon, {
      code: "ONCE",
      percentOff: 20,
      maxUses: 2,
      validUntilMs: Date.now() + 86400000,
      firstPurchaseOnly: true,
      betaUsersOnly: false,
    });
    const { order } = await prepare(user, "ONCE");
    await t.mutation(internal.proBilling.recordVerification, {
      id: order._id,
      transaction: { ...verified(order), status: "failed" },
      mode: "test",
    });
    await prepare(user, "ONCE");
    await t.mutation(internal.proBilling.recordVerification, {
      id: order._id,
      transaction: { ...verified(order), status: "pending" },
      mode: "test",
    });
    await t.mutation(internal.proBilling.recordVerification, {
      id: order._id,
      transaction: { ...verified(order), status: "failed" },
      mode: "test",
    });
    expect((await t.run((ctx) => ctx.db.get(couponId)))!.reservedUses).toBe(1);
  });
  it("rejects expired codes and beta codes for accounts created after the cutoff", async () => {
    const { t, user, userId } = await setup();
    await t.run((ctx) => ctx.db.patch(userId, { role: "admin" }));
    await user.mutation(api.proBilling.createCoupon, {
      code: "BETAONLY",
      percentOff: 20,
      maxUses: 100,
      validUntilMs: Date.now() + 1000,
      firstPurchaseOnly: true,
      betaUsersOnly: true,
    });
    vi.setSystemTime(Date.now() + 1);
    const otherId = await t.run((ctx) =>
      ctx.db.insert("users", { email: "late@example.com" }),
    );
    const other = t.withIdentity({ subject: `${otherId}|session` });
    await expect(prepare(other, "BETAONLY")).rejects.toThrow("unavailable");
    vi.setSystemTime(Date.now() + 1000);
    await expect(prepare(user, "BETAONLY")).rejects.toThrow("unavailable");
  });
  it("extends an existing paid period and leaves it intact after a failed renewal", async () => {
    const { t, user } = await setup();
    const { order: first } = await prepare(user);
    await t.mutation(internal.proBilling.recordVerification, {
      id: first._id,
      transaction: verified(first),
      mode: "test",
    });
    const before = (await user.query(api.proBilling.entitlements, {}))!;
    const { order: second } = await prepare(user);
    expect(second._id).not.toBe(first._id);
    await t.mutation(internal.proBilling.recordVerification, {
      id: second._id,
      transaction: { ...verified(second), status: "failed", id: 1235 },
      mode: "test",
    });
    expect(
      (await user.query(api.proBilling.entitlements, {}))!.expiresAtMs,
    ).toBe(before.expiresAtMs);
    const { order: third } = await prepare(user);
    await t.mutation(internal.proBilling.recordVerification, {
      id: third._id,
      transaction: { ...verified(third), id: 1236 },
      mode: "test",
    });
    expect(
      (await user.query(api.proBilling.entitlements, {}))!.expiresAtMs,
    ).toBe(addPlanPeriod(before.expiresAtMs!, "monthly"));
  });
  it("does not revoke an already verified entitlement when gateway mode changes", async () => {
    const { t, user } = await setup();
    const { order } = await prepare(user);
    await t.mutation(internal.proBilling.recordVerification, {
      id: order._id,
      transaction: verified(order),
      mode: "test",
    });
    vi.stubEnv("PRO_PAYMENT_MODE", "live");
    expect((await user.query(api.proBilling.entitlements, {}))!.paid).toBe(
      true,
    );
  });
  it("refuses test checkout on the production website", async () => {
    const { user } = await setup();
    vi.stubEnv("PRO_APP_ORIGIN", "https://poscalfx.com");
    await expect(prepare(user)).rejects.toThrow("temporarily unavailable");
  });
  it("a client-supplied clock cannot revive an expired subscription", async () => {
    const { t, user, userId } = await setup();
    await t.run((ctx) =>
      ctx.db.insert("proAccounts", {
        userId,
        paymentMode: "test",
        expiresAtMs: Date.now() - 1,
        updatedAtMs: Date.now(),
      }),
    );
    expect(
      (await user.query(api.proBilling.entitlements, { nowMs: 0 }))!.paid,
    ).toBe(false);
  });
  it("authenticates the exact raw webhook body before durable capture", async () => {
    const { t, user } = await setup();
    const { order } = await prepare(user);
    const raw = JSON.stringify({
      event: "charge.success",
      data: { reference: order.reference },
    });
    const signature = createHmac("sha512", "sk_test_fixture")
      .update(raw)
      .digest("hex");
    expect(
      await t.action(internal.proPayments.receiveWebhook, {
        raw: raw + " ",
        signature,
      }),
    ).toBe(false);
    expect(
      await t.run((ctx) => ctx.db.query("proWebhookEvents").collect()),
    ).toHaveLength(0);
    expect(
      await t.action(internal.proPayments.receiveWebhook, { raw, signature }),
    ).toBe(true);
    expect(
      await t.run((ctx) => ctx.db.query("proWebhookEvents").collect()),
    ).toHaveLength(1);
  });
});

describe("Free limits preserve beta data", () => {
  it("preserves all journals and notes on downgrade and offers one editable journal", async () => {
    const { t, user } = await setup(false);
    const first = await user.mutation(api.tradingJournals.create, {
      name: "First",
      currency: "USD",
      startingBalance: 10000,
    });
    const second = await user.mutation(api.tradingJournals.create, {
      name: "Second",
      currency: "USD",
      startingBalance: 10000,
    });
    const draft = await user.mutation(api.tradingJournal.createNotebookDraft, {
      journalId: second!._id,
    });
    await user.mutation(api.tradingJournal.updateNotebook, {
      id: draft!._id,
      entryReason: "Beta notes",
    });
    await t.run((ctx) =>
      ctx.db.insert("appSettings", {
        key: PRO_LOCK_KEY,
        valueBoolean: true,
        updatedAtMs: Date.now(),
      }),
    );
    expect(
      (await user.query(api.tradingJournals.listForUser, {})).map(
        (j) => j.isReadOnly,
      ),
    ).toContain(true);
    await expect(
      user.mutation(api.tradingJournal.updateNotebook, {
        id: draft!._id,
        entryReason: "Change",
      }),
    ).rejects.toThrow("read-only");
    expect(
      await user.query(api.tradingJournal.getNotebookByTrade, {
        id: draft!._id,
      }),
    ).toBeTruthy();
    await user.mutation(api.proBilling.chooseFreeJournal, {
      journalId: second!._id,
    });
    await user.mutation(api.tradingJournal.updateNotebook, {
      id: draft!._id,
      entryReason: "Now editable",
    });
    await expect(
      user.mutation(api.proBilling.chooseFreeJournal, {
        journalId: first!._id,
      }),
    ).rejects.toThrow("already been selected");
  });
  it("counts trades and notebook drafts together; existing beta entries do not consume launch allowance", async () => {
    const { t, user } = await setup(false);
    const journal = await user.mutation(api.tradingJournals.create, {
      name: "Journal",
      currency: "USD",
      startingBalance: 10000,
    });
    await user.mutation(api.tradingJournal.createNotebookDraft, {
      journalId: journal!._id,
    });
    await t.run((ctx) =>
      ctx.db.insert("appSettings", {
        key: PRO_LOCK_KEY,
        valueBoolean: true,
        updatedAtMs: Date.now(),
      }),
    );
    for (let i = 0; i < 15; i++)
      await user.mutation(api.tradingJournal.createNotebookDraft, {
        journalId: journal!._id,
      });
    await expect(
      user.mutation(api.tradingJournal.createNotebookDraft, {
        journalId: journal!._id,
      }),
    ).rejects.toThrow("Monthly entry allowance");
    expect(
      await t.run((ctx) => ctx.db.query("tradingJournal").collect()),
    ).toHaveLength(16);
  });
  it("expires access at the exact boundary even before expiry notifications run", async () => {
    const { t, user, userId } = await setup();
    vi.useFakeTimers();
    const now = Date.now();
    await t.run((ctx) =>
      ctx.db.insert("proAccounts", {
        userId,
        expiresAtMs: now + 1000,
        paymentMode: "test",
        updatedAtMs: now,
      }),
    );
    expect((await user.query(api.proBilling.entitlements, {}))!.paid).toBe(
      true,
    );
    vi.setSystemTime(now + 1000);
    expect((await user.query(api.proBilling.entitlements, {}))!.paid).toBe(
      false,
    );
  });
  it("preserves excess beta images, blocks new uploads, and unlocks after verified payment", async () => {
    const { t, user, userId } = await setup(false);
    const journal = await user.mutation(api.tradingJournals.create, {
      name: "Images",
      currency: "USD",
      startingBalance: 10000,
    });
    const trade = await user.mutation(api.tradingJournal.createNotebookDraft, {
      journalId: journal!._id,
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("userStorageUsage", {
        userId,
        usedBytes: 600,
        attachmentCount: 6,
        updatedAtMs: Date.now(),
      });
      for (let i = 0; i < 6; i++)
        await ctx.db.insert("tradeJournalAttachments", {
          userId,
          journalId: journal!._id,
          tradeId: trade!._id,
          role: "before",
          storageProvider: "r2",
          objectKey: `saved-${i}`,
          mimeType: "image/png",
          sizeBytes: 100,
          width: null,
          height: null,
          sortOrder: i,
          status: "ready",
          createdAtMs: Date.now(),
          updatedAtMs: Date.now(),
        });
      await ctx.db.insert("appSettings", {
        key: PRO_LOCK_KEY,
        valueBoolean: true,
        updatedAtMs: Date.now(),
      });
    });
    expect(
      await user.query(api.tradeJournalAttachments.listForTrade, {
        tradeId: trade!._id,
      }),
    ).toHaveLength(6);
    const upload = {
      tradeId: trade!._id,
      role: "after" as const,
      mimeType: "image/png",
      sizeBytes: 100,
    };
    await expect(
      user.mutation(api.tradeJournalAttachments.reserveUpload, upload),
    ).rejects.toThrow("Screenshot allowance");
    const { order } = await prepare(user);
    await t.mutation(internal.proBilling.recordVerification, {
      id: order._id,
      transaction: verified(order),
      mode: "test",
    });
    await expect(
      user.mutation(api.tradeJournalAttachments.reserveUpload, upload),
    ).resolves.toBeTruthy();
  });
  it("reserves the final Free screenshot slot atomically across simultaneous uploads", async () => {
    const { t, user, userId } = await setup();
    const journal = await user.mutation(api.tradingJournals.create, {
      name: "Images",
      currency: "USD",
      startingBalance: 10000,
    });
    const trade = await user.mutation(api.tradingJournal.createNotebookDraft, {
      journalId: journal!._id,
    });
    await t.run((ctx) =>
      ctx.db.insert("userStorageUsage", {
        userId,
        usedBytes: 400,
        attachmentCount: 4,
        updatedAtMs: Date.now(),
      }),
    );
    const uploads = await Promise.allSettled(
      ["before", "after"].map((role) =>
        user.mutation(api.tradeJournalAttachments.reserveUpload, {
          tradeId: trade!._id,
          role: role as "before" | "after",
          mimeType: "image/png",
          sizeBytes: 100,
        }),
      ),
    );
    expect(
      uploads.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      (await user.query(api.tradeJournalAttachments.getUsageForUser, {}))
        .reservedCount,
    ).toBe(1);
  });
});

describe("legacy migration safety", () => {
  const legacy = async () => {
    const { t, user, userId } = await setup(false);
    await t.run((ctx) =>
      ctx.db.patch(userId, {
        role: "admin",
        paymentStatus: "paid",
        subscriptionTier: "premium",
        subscriptionExpiresAtMs: Date.now() + 30 * 86400000,
      }),
    );
    const reference = `psk_${userId}_monthly_${Date.now()}`;
    const sourceId = await t.run((ctx) =>
      ctx.db.insert("paymentRecords", {
        userId,
        reference,
        tier: "premium",
        amount: 500,
        currency: "USD",
        status: "success",
        expiresAtMs: null,
        paidAtMs: Date.now(),
        metadata: null,
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
      }),
    );
    return { t, user, userId, reference, sourceId };
  };
  it("requires a backup and leaves originals in place during gateway outages", async () => {
    const { t, user, sourceId } = await legacy();
    await expect(
      user.action(api.proPayments.migrateLegacyBatch, {
        backupConfirmed: false,
      }),
    ).rejects.toThrow("backup");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("outage")));
    expect(
      await user.action(api.proPayments.migrateLegacyBatch, {
        backupConfirmed: true,
      }),
    ).toMatchObject({ archived: 0, remaining: true });
    expect(await t.run((ctx) => ctx.db.get(sourceId))).not.toBeNull();
    expect(
      await t.run((ctx) => ctx.db.query("proLegacyPayments").collect()),
    ).toHaveLength(0);
  });
  it("archives verified legacy proof and replaces access before removing old rows/fields", async () => {
    const { t, user, userId, reference, sourceId } = await legacy();
    const proof = {
      status: "success",
      reference,
      amount: 500,
      currency: "USD",
      domain: "test",
      id: 888,
      metadata: { userId, planId: "monthly" },
      paid_at: new Date().toISOString(),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              status: true,
              data: url.includes("/transaction/verify/") ? proof : [],
            }),
            { status: 200 },
          ),
        ),
      ),
    );
    expect(
      await user.action(api.proPayments.migrateLegacyBatch, {
        backupConfirmed: true,
      }),
    ).toMatchObject({ archived: 1, remaining: false });
    expect(await t.run((ctx) => ctx.db.get(sourceId))).toBeNull();
    expect(
      (await t.run((ctx) => ctx.db.query("proLegacyPayments").first()))!
        .verification,
    ).toBe("verified");
    expect((await user.query(api.proBilling.entitlements, {}))!.paid).toBe(
      true,
    );
    await t.mutation(internal.proBilling.cleanLegacyFields, {
      table: "users",
      cursor: null,
    });
    expect(
      (await t.run((ctx) => ctx.db.get(userId)))!.paymentStatus,
    ).toBeUndefined();
    expect((await user.query(api.proBilling.entitlements, {}))!.paid).toBe(
      true,
    );
  });
  it("keeps the legacy original when failure proof belongs to a different transaction", async () => {
    const { t, user, sourceId } = await legacy();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: true,
            data: {
              status: "failed",
              reference: "some-other-payment",
              domain: "test",
            },
          }),
          { status: 200 },
        ),
      ),
    );
    expect(
      await user.action(api.proPayments.migrateLegacyBatch, {
        backupConfirmed: true,
      }),
    ).toMatchObject({ archived: 0, remaining: true });
    expect(await t.run((ctx) => ctx.db.get(sourceId))).not.toBeNull();
  });
  it("rejects a saved success when the gateway reports failure", async () => {
    const { t, user, reference } = await legacy();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: true,
            data: { status: "failed", reference, domain: "test" },
          }),
          { status: 200 },
        ),
      ),
    );
    expect(
      await user.action(api.proPayments.migrateLegacyBatch, {
        backupConfirmed: true,
      }),
    ).toMatchObject({ archived: 1 });
    expect((await user.query(api.proBilling.entitlements, {}))!.paid).toBe(
      false,
    );
    expect(
      (await t.run((ctx) => ctx.db.query("proLegacyPayments").first()))!
        .verification,
    ).toBe("rejected");
  });
});

describe("billing policy", () => {
  it("clamps month/year ends and preserves time of day", () => {
    expect(
      new Date(
        addPlanPeriod(Date.parse("2026-01-31T15:30:00Z"), "monthly"),
      ).toISOString(),
    ).toBe("2026-02-28T15:30:00.000Z");
    expect(
      new Date(
        addPlanPeriod(Date.parse("2024-02-29T15:30:00Z"), "yearly"),
      ).toISOString(),
    ).toBe("2025-02-28T15:30:00.000Z");
  });
  it("rejects external and malformed return destinations", () => {
    for (const path of [
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "https://evil.example",
    ])
      expect(safeReturnTo(path)).toBe("/journal");
    expect(safeReturnTo("/journal?tab=notes&token=secret")).toBe(
      "/journal?tab=notes",
    );
  });
  it("does not mistake top-level API success for transaction success", () => {
    expect(
      verifyTransactionMatch(
        { status: "failed" },
        {
          _id: "id",
          reference: "ref",
          amount: PRICES.monthly,
          currency: "NGN",
        },
        "live",
      ),
    ).toBe(false);
  });
});


describe("production billing hardening", () => {
  it("keeps an already verified grant active when the runtime payment mode changes", async () => {
    const { t, user, userId } = await setup();
    const now = Date.now();
    await t.run((ctx) =>
      ctx.db.insert("proAccounts", {
        userId,
        expiresAtMs: now + 86400_000,
        paymentMode: "test",
        updatedAtMs: now,
      }),
    );

    vi.stubEnv("PRO_PAYMENT_MODE", "live");
    expect((await user.query(api.proBilling.entitlements, {}))!.paid).toBe(true);
  });

  it("cannot rotate the Free journal by deleting the current Free journal", async () => {
    const { t, user } = await setup(false);
    const first = await user.mutation(api.tradingJournals.create, {
      name: "First",
      currency: "USD",
      startingBalance: 10000,
    });
    await user.mutation(api.tradingJournals.create, {
      name: "Second",
      currency: "USD",
      startingBalance: 10000,
    });
    await t.run((ctx) =>
      ctx.db.insert("appSettings", {
        key: PRO_LOCK_KEY,
        valueBoolean: true,
        updatedAtMs: Date.now(),
      }),
    );

    expect((await user.query(api.proBilling.entitlements, {}))!.freeJournalId).toBe(
      first!._id,
    );
    await expect(
      user.mutation(api.tradingJournals.remove, { id: first!._id }),
    ).rejects.toThrow("Choose your one Free journal");
  });

  it("only enables auto-renew from a verified reusable Paystack authorization", async () => {
    const { t, user, userId } = await setup();
    const { order } = await user.mutation(internal.proBilling.prepareOrder, {
      plan: "monthly",
      reminders: false,
      returnTo: "/journal",
      autoRenew: true,
    });

    await t.mutation(internal.proBilling.recordVerification, {
      id: order._id,
      transaction: {
        ...verified(order),
        authorization: {
          authorization_code: "AUTH_fixture",
          signature: "SIG_fixture",
          reusable: true,
          channel: "card",
          last4: "4081",
          card_type: "visa",
          bank: "TEST BANK",
          exp_month: "12",
          exp_year: "2030",
          country_code: "NG",
        },
      },
      mode: "test",
    });

    expect((await user.query(api.proBilling.entitlements, {}))!.autoRenew).toMatchObject({
      enabled: true,
      plan: "monthly",
      last4: "4081",
    });

    await user.mutation(api.proBilling.setAutoRenew, { enabled: false });
    expect((await user.query(api.proBilling.entitlements, {}))!.autoRenew).toMatchObject({
      enabled: false,
      last4: null,
      brand: null,
    });
    const account = await t.run((ctx) =>
      ctx.db
        .query("proAccounts")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique(),
    );
    expect(account?.autoRenewAuthorizationCode).toBeUndefined();
    expect(account?.autoRenewSignature).toBeUndefined();
  });

  it("keeps auto-renew enabled after a verified scheduled renewal", async () => {
    const { t, user, userId } = await setup();
    const now = Date.now();
    const accountId = await t.run((ctx) =>
      ctx.db.insert("proAccounts", {
        userId,
        expiresAtMs: now + 86400_000,
        paymentMode: "test",
        autoRenewEnabled: true,
        autoRenewPlan: "monthly",
        autoRenewAuthorizationCode: "AUTH_fixture",
        autoRenewEmail: "trader@example.com",
        autoRenewSignature: "SIG_fixture",
        autoRenewNextChargeAtMs: now - 1,
        autoRenewFailureCount: 0,
        updatedAtMs: now,
      }),
    );

    const order = await t.mutation(internal.proBilling.prepareAutoRenewOrder, {
      id: accountId,
    });
    await t.mutation(internal.proBilling.recordVerification, {
      id: order._id,
      transaction: verified(order),
      mode: "test",
    });

    const access = await user.query(api.proBilling.entitlements, {});
    expect(access!.autoRenew.enabled).toBe(true);
    expect(access!.autoRenew.nextChargeAtMs).toBeGreaterThan(now);
    const account = await t.run((ctx) => ctx.db.get(accountId));
    expect(account!.autoRenewOrderId).toBeUndefined();
    expect(account!.autoRenewFailureCount).toBe(0);
  });

  it("account deletion removes reusable Paystack authorization and stops auto-renew", async () => {
    const { t, user, userId } = await setup();
    const now = Date.now();
    const accountId = await t.run((ctx) =>
      ctx.db.insert("proAccounts", {
        userId,
        expiresAtMs: now + 86400_000,
        paymentMode: "test",
        autoRenewEnabled: true,
        autoRenewPlan: "monthly",
        autoRenewAuthorizationCode: "AUTH_delete_me",
        autoRenewEmail: "trader@example.com",
        autoRenewSignature: "SIG_delete_me",
        autoRenewNextChargeAtMs: now - 1,
        updatedAtMs: now,
      }),
    );

    await user.mutation(api.users.beginAccountDeletion, { confirmation: "DELETE" });
    await user.mutation(api.users.deleteAccount, { confirmation: "DELETE" });

    expect(await t.run((ctx) => ctx.db.get(accountId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(userId))).toBeNull();
    expect(
      await t.mutation(internal.proBilling.claimAutoRenew, { id: accountId }),
    ).toBe(false);
  });

  it("a late verified payment after account deletion is quarantined and cannot recreate access", async () => {
    const { t, user, userId } = await setup();
    const { order } = await prepare(user);

    await user.mutation(api.users.beginAccountDeletion, { confirmation: "DELETE" });
    await user.mutation(api.users.deleteAccount, { confirmation: "DELETE" });
    expect(await t.run((ctx) => ctx.db.get(userId))).toBeNull();

    await t.mutation(internal.proBilling.recordVerification, {
      id: order._id,
      transaction: verified(order),
      mode: "test",
    });

    const saved = await t.run((ctx) => ctx.db.get(order._id));
    expect(saved?.status).toBe("review");
    expect(saved?.reviewReason).toMatch(/Account was deleted/);
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("proAccounts")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .unique(),
      ),
    ).toBeNull();
  });

  it("billing kill switch blocks due auto-renew claims", async () => {
    const { t, user, userId } = await setup();
    const now = Date.now();
    const accountId = await t.run((ctx) =>
      ctx.db.insert("proAccounts", {
        userId,
        expiresAtMs: now + 86400_000,
        paymentMode: "test",
        autoRenewEnabled: true,
        autoRenewPlan: "monthly",
        autoRenewAuthorizationCode: "AUTH_fixture",
        autoRenewEmail: "trader@example.com",
        autoRenewSignature: "SIG_fixture",
        autoRenewNextChargeAtMs: now - 1,
        updatedAtMs: now,
      }),
    );
    const setting = await t.run((ctx) =>
      ctx.db
        .query("appSettings")
        .withIndex("by_key", (q) => q.eq("key", PRO_LOCK_KEY))
        .unique(),
    );
    await t.run((ctx) => ctx.db.patch(setting!._id, { valueBoolean: false }));

    expect(
      await t.mutation(internal.proBilling.claimAutoRenew, { id: accountId }),
    ).toBe(false);

    expect((await user.query(api.proBilling.entitlements, {}))!.beta).toBe(true);
  });
});


describe("account deletion cleanup", () => {
  it("allows the selected Free journal to enter cleanup only after explicit account deletion starts", async () => {
    const { user } = await setup(false);
    const journal = await user.mutation(api.tradingJournals.create, {
      name: "Free journal",
      currency: "USD",
      startingBalance: 10000,
    });

    await expect(
      user.mutation(api.tradingJournals.beginRemove, { id: journal!._id }),
    ).rejects.toThrow("Choose your one Free journal");

    await user.mutation(api.users.beginAccountDeletion, {
      confirmation: "DELETE",
    });
    await expect(
      user.mutation(api.tradingJournals.beginRemove, { id: journal!._id }),
    ).resolves.toEqual({ success: true });
  });

  it("refuses final account deletion until asset-aware journal cleanup is complete", async () => {
    const { user } = await setup(false);
    await user.mutation(api.tradingJournals.create, {
      name: "Has data",
      currency: "USD",
      startingBalance: 10000,
    });
    await user.mutation(api.users.beginAccountDeletion, {
      confirmation: "DELETE",
    });
    await expect(
      user.mutation(api.users.deleteAccount, { confirmation: "DELETE" }),
    ).rejects.toThrow("asset");
  });
});

describe("resumable journal deletion", () => {
  it("cleans entry-owned rows before deleting the parent journal", async () => {
    const { t, user } = await setup(false);
    const journal = await user.mutation(api.tradingJournals.create, {
      name: "Delete me",
      currency: "USD",
      startingBalance: 10000,
    });
    const trade = await user.mutation(api.tradingJournal.createNotebookDraft, {
      journalId: journal!._id,
    });
    await user.mutation(api.tradingJournal.updateNotebook, {
      id: trade!._id,
      title: "Delete test",
      entryReason: "Test",
      duringTradeNotes: null,
      postTradeReview: null,
      lessonsLearned: null,
    });

    await user.mutation(api.tradingJournals.beginRemove, { id: journal!._id });
    const batch = await user.query(api.tradingJournals.removeBatch, {
      id: journal!._id,
    });
    expect(batch.tradeIds).toContain(trade!._id);

    await user.mutation(api.tradingJournal.beginDeleteEntry, { id: trade!._id });
    await user.mutation(api.tradingJournal.finalizeDeleteEntry, { id: trade!._id });

    expect(
      await user.mutation(api.tradingJournals.cleanupRemoveBatch, {
        id: journal!._id,
      }),
    ).toEqual({ done: true });
    expect(await t.run((ctx) => ctx.db.get(journal!._id))).toBeNull();
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("tradeNotebooks")
          .withIndex("by_journal", (q) => q.eq("journalId", journal!._id))
          .collect(),
      ),
    ).toHaveLength(0);
  });
});
