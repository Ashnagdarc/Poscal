"use node";
import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { verifyTransactionMatch } from "../shared/proPolicy";
import type { Doc } from "./_generated/dataModel";
const planValidator = v.union(v.literal("monthly"), v.literal("yearly"));

function secret() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("Payment verification is unavailable");
  return key;
}

class ProviderError extends Error {
  constructor(readonly status: number) {
    super(`Provider request failed (${status})`);
  }
}

async function paystack(path: string, body?: object) {
  const response = await fetch(`https://api.paystack.co${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      authorization: `Bearer ${secret()}`,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new ProviderError(response.status);
  const raw = await response.text();
  const result = JSON.parse(raw.replace(/"id"\s*:\s*(\d{16,})/g, '"id":"$1"'));
  if (result.status !== true || !result.data)
    throw new Error("Provider response is incomplete");
  return result.data;
}

export const startCheckout = action({
  args: {
    plan: planValidator,
    code: v.optional(v.string()),
    returnTo: v.optional(v.string()),
    reminders: v.boolean(),
    autoRenew: v.optional(v.boolean()),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const prepared: { order: Doc<"proOrders">; initialize: boolean } =
      await ctx.runMutation(internal.proBilling.prepareOrder, args);
    const order = prepared.order;
    if (prepared.initialize) {
      try {
        const data = await paystack("/transaction/initialize", {
          email: order.email,
          amount: String(order.amount),
          currency: order.currency,
          reference: order.reference,
          callback_url: `${process.env.PRO_APP_ORIGIN}/pro/return`,
          metadata: JSON.stringify({
            orderId: order._id,
            product: "poscal_pro",
            policyVersion: 1,
            autoRenewRequested: order.autoRenewRequested === true,
          }),
          // No plan code: Paystack plan codes override the quoted amount.
        });
        if (
          data.reference !== order.reference ||
          typeof data.access_code !== "string" ||
          !data.access_code.trim()
        )
          throw new Error("Provider initialization does not match the order");
        await ctx.runMutation(internal.proBilling.initialized, {
          id: order._id,
          accessCode: data.access_code,
          checkoutUrl: data.authorization_url,
        });
      } catch {
        // A timeout is ambiguous. Keep the same reference, then requery.
        await ctx.runMutation(internal.proBilling.initialized, {
          id: order._id,
        });
      }
    }
    return order.reference;
  },
});

export const checkPayment = action({
  args: { reference: v.string(), admin: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    if (args.reference.length > 150)
      throw new Error("Invalid payment reference");
    const id = await ctx.runQuery(internal.proBilling.ownedOrderId, args);
    if (!id) throw new Error("Payment not found for this account");
    await ctx.runAction(internal.proPayments.reconcileOrder, { id });
    return null;
  },
});

export const reconcileOrder = internalAction({
  args: { id: v.id("proOrders") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    if (!(await ctx.runMutation(internal.proBilling.claimVerification, args)))
      return null;
    const order: Doc<"proOrders"> | null = await ctx.runQuery(
      internal.proBilling.getOrder,
      args,
    );
    if (!order) return null;
    const mode = process.env.PRO_PAYMENT_MODE;
    if (mode !== "test" && mode !== "live") return null;
    let transaction: unknown = null;
    let error: string | undefined;
    let financialReview: string | undefined;
    let financialChecked = false;
    try {
      const data = await paystack(
        `/transaction/verify/${encodeURIComponent(order.reference)}`,
      );
      transaction = data;
      if (verifyTransactionMatch(data, order, mode)) {
        const id = encodeURIComponent(String(data.id));
        const [refunds, disputes] = await Promise.all([
          paystack(`/refund?transaction=${id}&perPage=100`),
          paystack(`/dispute?transaction=${id}&perPage=100`),
        ]);
        if (
          !Array.isArray(refunds) ||
          !Array.isArray(disputes) ||
          refunds.length >= 100 ||
          disputes.length >= 100
        )
          throw new Error("Financial review incomplete");
        financialChecked = true;
        if (
          (order.reviewReason?.startsWith("refund.") && refunds.length === 0) ||
          refunds.some((refund) => refund.status !== "failed")
        )
          financialReview =
            "refund.processed: refund or partial refund requires review";
        if (
          (order.reviewReason?.startsWith("charge.dispute") &&
            disputes.length === 0) ||
          disputes.some(
            (dispute) =>
              !(
                dispute.status === "resolved" &&
                dispute.resolution === "declined"
              ),
          )
        )
          financialReview = "charge.dispute: dispute requires review";
      }
    } catch (failure) {
      // No access code was ever committed or delivered, and the provider confirms
      // that this reference does not exist. Only this narrow case can be retried.
      if (
        failure instanceof ProviderError &&
        failure.status === 404 &&
        !order.accessCode &&
        !order.grantEndMs &&
        (["initializing", "review"].includes(order.status) ||
          (order.source === "auto_renew" && order.status === "pending")) &&
        Date.now() - order.createdAtMs > 2 * 60_000 &&
        !order.reviewReason?.startsWith("refund.") &&
        !order.reviewReason?.startsWith("charge.dispute")
      ) {
        transaction = {
          status: "abandoned",
          reference: order.reference,
          domain: mode,
        };
      } else error = "Provider verification is temporarily unavailable";
    }
    await ctx.runMutation(internal.proBilling.recordVerification, {
      id: order._id,
      transaction,
      mode,
      error,
      financialReview,
      financialChecked,
      financialHoldDigest: order.financialHoldDigest,
    });
    return null;
  },
});

export const chargeAutoRenew = internalAction({
  args: { id: v.id("proAccounts") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    if (!(await ctx.runMutation(internal.proBilling.claimAutoRenew, args)))
      return null;

    const mode = process.env.PRO_PAYMENT_MODE;
    if (mode !== "test" && mode !== "live") return null;

    const account = await ctx.runQuery(internal.proBilling.getAutoRenewAccount, args);
    if (
      !account ||
      account.autoRenewEnabled !== true ||
      !account.autoRenewAuthorizationCode ||
      !account.autoRenewEmail ||
      !account.autoRenewPlan
    )
      return null;

    const order: Doc<"proOrders"> = await ctx.runMutation(
      internal.proBilling.prepareAutoRenewOrder,
      args,
    );

    try {
      const charged = await paystack("/transaction/charge_authorization", {
        authorization_code: account.autoRenewAuthorizationCode,
        email: account.autoRenewEmail,
        amount: String(order.amount),
        currency: order.currency,
        reference: order.reference,
        metadata: JSON.stringify({
          orderId: order._id,
          product: "poscal_pro",
          policyVersion: 1,
          source: "auto_renew",
        }),
      });

      // The immediate charge response is never authoritative for entitlements.
      // Requery the transaction by our immutable reference before granting access.
      await ctx.scheduler.runAfter(
        charged?.reference === order.reference ? 0 : 2 * 60_000,
        internal.proPayments.reconcileOrder,
        { id: order._id },
      );
    } catch {
      // A timeout is financially ambiguous. Keep the same order/reference and
      // verify it before any retry, so we cannot double-debit the customer.
      await ctx.scheduler.runAfter(
        2 * 60_000,
        internal.proPayments.reconcileOrder,
        { id: order._id },
      );
    }
    return null;
  },
});

export const runAutoRenewDue = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    const ids = await ctx.runQuery(internal.proBilling.dueAutoRenewAccounts, {});
    for (const id of ids)
      await ctx.scheduler.runAfter(0, internal.proPayments.chargeAutoRenew, { id });
    return null;
  },
});

export const reconcileDue = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    const ids = await ctx.runQuery(internal.proBilling.dueOrders, {});
    // Independent jobs prevent one unavailable transaction from blocking the batch.
    for (const id of ids)
      await ctx.scheduler.runAfter(0, internal.proPayments.reconcileOrder, {
        id,
      });
    return null;
  },
});

export const receiveWebhook = internalAction({
  args: { raw: v.string(), signature: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args): Promise<boolean> => {
    if (args.raw.length > 200_000 || !/^[a-f0-9]{128}$/i.test(args.signature))
      return false;
    const expected = createHmac("sha512", secret()).update(args.raw).digest();
    if (!timingSafeEqual(expected, Buffer.from(args.signature, "hex")))
      return false;
    let payload;
    try {
      payload = JSON.parse(
        args.raw.replace(/"(id|transaction)"\s*:\s*(\d{16,})/g, '"$1":"$2"'),
      );
    } catch {
      return false;
    }
    if (typeof payload.event !== "string") return false;
    const data = payload.data ?? {};
    const transaction = data.transaction;
    const reference =
      typeof data.reference === "string"
        ? data.reference
        : typeof transaction?.reference === "string"
          ? transaction.reference
          : undefined;
    const providerId =
      transaction?.id ??
      (typeof transaction === "number" || typeof transaction === "string"
        ? transaction
        : payload.event === "charge.success"
          ? data.id
          : undefined);
    await ctx.runMutation(internal.proBilling.captureWebhook, {
      digest: createHash("sha256").update(args.raw).digest("hex"),
      event: payload.event,
      reference,
      providerId: providerId === undefined ? undefined : String(providerId),
    });
    // Only acknowledge once the inbox row and recovery job are durable.
    return true;
  },
});

export const migrateLegacyBatch = action({
  args: { backupConfirmed: v.boolean() },
  returns: v.object({
    archived: v.number(),
    remaining: v.boolean(),
    errors: v.array(v.string()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ archived: number; remaining: boolean; errors: string[] }> => {
    if (!args.backupConfirmed)
      throw new Error("Export and verify a database backup before migration");
    const { actor, rows } = await ctx.runQuery(
      internal.proBilling.legacyBatch,
      {},
    );
    const mode = process.env.PRO_PAYMENT_MODE;
    if (mode !== "live" && mode !== "test")
      throw new Error("Set the payment environment before migration");
    let archived = 0;
    const errors: string[] = [];
    for (const source of rows) {
      try {
        const transaction = await paystack(
          `/transaction/verify/${encodeURIComponent(source.reference)}`,
        );
        if (transaction.status === "success") {
          const id = encodeURIComponent(String(transaction.id));
          const [refunds, disputes] = await Promise.all([
            paystack(`/refund?transaction=${id}&perPage=100`),
            paystack(`/dispute?transaction=${id}&perPage=100`),
          ]);
          if (
            !Array.isArray(refunds) ||
            !Array.isArray(disputes) ||
            refunds.length >= 100 ||
            disputes.length >= 100
          )
            throw new Error("Incomplete financial review");
          if (
            refunds.some((r) => r.status !== "failed") ||
            disputes.some(
              (d) => !(d.status === "resolved" && d.resolution === "declined"),
            )
          )
            throw new Error("Refund/dispute needs operator review");
        }
        if (
          !["success", "failed", "abandoned", "reversed"].includes(
            transaction.status,
          )
        )
          throw new Error("Payment is still pending");
        await ctx.runMutation(internal.proBilling.archiveLegacy, {
          sourceId: source._id,
          actor,
          transaction,
          mode,
        });
        archived++;
      } catch {
        errors.push(
          `${source.reference}: not migrated; verify gateway status or resolve the outstanding refund/dispute.`,
        );
      }
    }
    const remaining = rows.length === 20 || errors.length > 0;
    if (!remaining)
      await ctx.runMutation(internal.proBilling.startLegacyCleanup, { actor });
    return { archived, remaining, errors };
  },
});
