import {
  accessValidator,
  orderDoc,
  couponDoc,
  clientOrderValidator,
} from "./lib/proValidators";
import { paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireVerifiedAuthUserId, getVerifiedAuthUserId } from "./lib/auth";
import { getProAccess } from "./lib/proAccess";
import {
  addPlanPeriod,
  discountAmount,
  PRICES,
  PRO_LOCK_KEY,
  safeReturnTo,
  verifyTransactionMatch,
  type ProPlan,
} from "../shared/proPolicy";

export const planValidator = v.union(v.literal("monthly"), v.literal("yearly"));
const CLOSED = Number.MAX_SAFE_INTEGER;

const clearAutoRenewPaymentMethod = () => ({
  autoRenewAuthorizationCode: undefined,
  autoRenewEmail: undefined,
  autoRenewSignature: undefined,
  autoRenewChannel: undefined,
  autoRenewLast4: undefined,
  autoRenewBrand: undefined,
  autoRenewBank: undefined,
  autoRenewExpMonth: undefined,
  autoRenewExpYear: undefined,
  autoRenewCountryCode: undefined,
});

async function requireAdmin(ctx: QueryCtx) {
  const userId = await requireVerifiedAuthUserId(ctx);
  const user = await ctx.db.get(userId);
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_external_user_id", (q) => q.eq("externalUserId", userId))
    .unique();
  if (!["admin", "super_admin"].includes(profile?.role ?? user?.role ?? ""))
    throw new Error("Admin access required");
  return userId;
}

export function gatewayReady() {
  const key = process.env.PAYSTACK_SECRET_KEY ?? "";
  const mode = process.env.PRO_PAYMENT_MODE;
  const origin = process.env.PRO_APP_ORIGIN ?? "";
  try {
    if (new URL(origin).origin !== origin) return false;
  } catch {
    return false;
  }
  const productionOrigin = [
    "https://poscalfx.com",
    "https://www.poscalfx.com",
  ].includes(origin);
  return (
    (productionOrigin ? mode === "live" : mode === "test") &&
    key.startsWith(mode === "live" ? "sk_live_" : "sk_test_") &&
    /^https:\/\/[^/]+$/.test(origin) &&
    !!process.env.RESEND_API_KEY &&
    !!process.env.VAPID_PUBLIC_KEY &&
    !!process.env.VAPID_PRIVATE_KEY
  );
}

async function accountFor(ctx: MutationCtx, userId: Id<"users">) {
  const existing = await ctx.db
    .query("proAccounts")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (existing) return existing;
  if (!(await ctx.db.get(userId))) {
    throw new Error("Billing account owner no longer exists");
  }
  const id = await ctx.db.insert("proAccounts", {
    userId,
    expiresAtMs: 0,
    updatedAtMs: Date.now(),
  });
  return (await ctx.db.get(id))!;
}

/** Notification records are committed in the same transaction as their payment state. */
async function notify(
  ctx: MutationCtx,
  order: Doc<"proOrders">,
  kind: string,
  title: string,
  body: string,
  delay = 0,
) {
  const tag = `pro-${order._id}-${kind}`;
  const existing = await ctx.db
    .query("notificationQueue")
    .withIndex("by_tag", (q) => q.eq("tag", tag))
    .first();
  if (existing) return;
  const now = Date.now();
  const data = {
    billingOrderId: order._id,
    billingKind: kind,
    url: `/pro?reference=${encodeURIComponent(order.reference)}`,
    html: null,
  };
  await ctx.db.insert("notificationQueue", {
    userId: order.userId,
    channel: "email",
    recipientEmail: order.email,
    title,
    body: `${body}\nPlan: ${order.plan}. Amount: NGN ${(order.amount / 100).toFixed(2)}.\nPayment reference: ${order.reference}\nManage your payment: ${process.env.PRO_APP_ORIGIN ?? "https://poscalfx.com"}${data.url}`,
    tag,
    data,
    status: "pending",
    attempts: 0,
    scheduledForMs: now + delay,
    processingStartedAtMs: null,
    errorMessage: null,
    createdAtMs: now,
    updatedAtMs: now,
  });
  await ctx.scheduler.runAfter(
    delay,
    internal.notifications.enqueueDevicePushes,
    { userId: order.userId, title, body, tag, deliveryKey: kind, data },
  );
}

export const entitlements = query({
  args: { nowMs: v.optional(v.number()) },
  returns: v.union(accessValidator, v.null()),
  handler: async (ctx, _args) => {
    const userId = await getVerifiedAuthUserId(ctx);
    return userId ? await getProAccess(ctx, userId) : null;
  },
});

export const publicConfiguration = query({
  args: {},
  returns: v.object({
    beta: v.boolean(),
    ready: v.boolean(),
    monthly: v.number(),
    yearly: v.number(),
  }),
  handler: async (ctx) => {
    const row = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", PRO_LOCK_KEY))
      .unique();
    return {
      beta: row?.valueBoolean !== true,
      ready: gatewayReady(),
      ...PRICES,
    };
  },
});

export const chooseFreeJournal = mutation({
  args: { journalId: v.id("tradingAccounts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    const journal = await ctx.db.get(args.journalId);
    if (!journal || journal.userId !== userId || journal.status === "archived")
      throw new Error("Choose an active journal you own");
    const account = await accountFor(ctx, userId);
    if (account.freeJournalChosen)
      throw new Error("Your Free journal has already been selected");
    await ctx.db.patch(account._id, {
      freeJournalId: args.journalId,
      freeJournalChosen: true,
      updatedAtMs: Date.now(),
    });
    return null;
  },
});

async function quoteFor(
  ctx: QueryCtx,
  userId: Id<"users">,
  plan: ProPlan,
  code?: string,
) {
  const baseAmount = PRICES[plan];
  if (!code?.trim()) return { baseAmount, amount: baseAmount, coupon: null };
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(normalized))
    throw new Error("Discount code is unavailable");
  const coupon = await ctx.db
    .query("proCoupons")
    .withIndex("by_code", (q) => q.eq("code", normalized))
    .unique();
  const user = await ctx.db.get(userId);
  if (
    !coupon ||
    !coupon.enabled ||
    coupon.validUntilMs <= Date.now() ||
    coupon.reservedUses + coupon.redeemedUses >= coupon.maxUses ||
    (coupon.plan && coupon.plan !== plan) ||
    (coupon.betaUsersOnly &&
      (!user || user._creationTime > coupon.betaCutoffMs))
  )
    throw new Error("Discount code is unavailable");
  const account = await ctx.db
    .query("proAccounts")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  const uses = await ctx.db
    .query("proOrders")
    .withIndex("by_user_coupon", (q) =>
      q.eq("userId", userId).eq("couponId", coupon._id),
    )
    .take(25);
  if (
    uses.length >= 25 ||
    uses.some(
      (o) =>
        !!o.grantEndMs ||
        !["failed", "abandoned", "reversed"].includes(o.status),
    ) ||
    (coupon.firstPurchaseOnly && account?.hasPaidBefore)
  )
    throw new Error("Discount code is unavailable for this account");
  return {
    baseAmount,
    amount: discountAmount(baseAmount, coupon.percentOff),
    coupon,
  };
}

export const quote = query({
  args: { plan: planValidator, code: v.optional(v.string()) },
  returns: v.object({
    amount: v.number(),
    baseAmount: v.number(),
    currency: v.literal("NGN"),
    code: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    const result = await quoteFor(ctx, userId, args.plan, args.code);
    return {
      amount: result.amount,
      baseAmount: result.baseAmount,
      currency: "NGN" as const,
      code: result.coupon?.code ?? null,
    };
  },
});

/** A single transaction serializes simultaneous tabs/clicks before any gateway request. */
export const prepareOrder = internalMutation({
  args: {
    plan: planValidator,
    code: v.optional(v.string()),
    returnTo: v.optional(v.string()),
    reminders: v.boolean(),
    autoRenew: v.optional(v.boolean()),
  },
  returns: v.object({ order: orderDoc, initialize: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    const access = await getProAccess(ctx, userId);
    if (!access.enabled)
      throw new Error("Beta is open. Payments are switched off.");
    if (!gatewayReady()) throw new Error("Checkout is temporarily unavailable");
    const user = await ctx.db.get(userId);
    if (!user?.email) throw new Error("Add an email address before paying");
    const account = await accountFor(ctx, userId);
    if (account.activeOrderId) {
      const existing = await ctx.db.get(account.activeOrderId);
      if (
        existing &&
        ["initializing", "pending", "review"].includes(existing.status)
      )
        return { order: existing, initialize: false };
    }
    // Limit checkout creation, including repeated failed payments.
    const recent = await ctx.db
      .query("proOrders")
      .withIndex("by_user_created", (q) =>
        q.eq("userId", userId).gt("createdAtMs", Date.now() - 3600_000),
      )
      .take(6);
    if (recent.length >= 5)
      throw new Error(
        "Too many attempts. Please wait before starting another payment.",
      );
    const price = await quoteFor(ctx, userId, args.plan, args.code);
    const now = Date.now();
    const id = await ctx.db.insert("proOrders", {
      userId,
      email: user.email,
      reference: "",
      plan: args.plan,
      mode: process.env.PRO_PAYMENT_MODE as "test" | "live",
      amount: price.amount,
      baseAmount: price.baseAmount,
      currency: "NGN",
      status: "initializing",
      couponId: price.coupon?._id,
      couponCode: price.coupon?.code,
      couponReservationActive: !!price.coupon,
      returnTo: safeReturnTo(args.returnTo),
      reminders: args.reminders,
      source: "checkout",
      autoRenewRequested: args.autoRenew === true,
      nextCheckAtMs: now + 60_000,
      checks: 0,
      createdAtMs: now,
      updatedAtMs: now,
    });
    await ctx.db.patch(id, { reference: `ppro-${id}` });
    await ctx.db.patch(account._id, { activeOrderId: id, updatedAtMs: now });
    if (price.coupon)
      await ctx.db.patch(price.coupon._id, {
        reservedUses: price.coupon.reservedUses + 1,
      });
    if (args.reminders)
      await ctx.scheduler.runAfter(
        60 * 60_000,
        internal.proBilling.unfinishedNotice,
        { id },
      );
    // If the action dies before responding, the cron still reconciles this order.
    return { order: (await ctx.db.get(id))!, initialize: true };
  },
});

export const initialized = internalMutation({
  args: {
    id: v.id("proOrders"),
    accessCode: v.optional(v.string()),
    checkoutUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.id);
    if (!order || order.status !== "initializing") return null;
    if (
      args.accessCode &&
      args.checkoutUrl &&
      /^https:\/\/checkout\.paystack\.com\//.test(args.checkoutUrl)
    ) {
      await ctx.db.patch(order._id, {
        accessCode: args.accessCode,
        checkoutUrl: args.checkoutUrl,
        status: "pending",
        updatedAtMs: Date.now(),
      });
      await notify(
        ctx,
        order,
        "pending",
        "Your Poscal Pro payment is pending",
        "We are checking your payment. Do not pay again while it is pending.",
        10 * 60_000,
      );
    } else {
      await ctx.db.patch(order._id, {
        status: "review",
        reviewReason:
          "Initialization could not be confirmed. Verify before retrying.",
        updatedAtMs: Date.now(),
      });
      await notify(
        ctx,
        order,
        "pending",
        "Your Poscal Pro checkout needs confirmation",
        "We are checking this checkout. If you were debited, do not pay again while confirmation is pending.",
        10 * 60_000,
      );
    }
    return null;
  },
});

function clientOrder(order: Doc<"proOrders">) {
  return {
    id: order._id,
    reference: order.reference,
    status: order.status,
    plan: order.plan,
    amount: order.amount,
    currency: order.currency,
    checkoutUrl: order.checkoutUrl ?? null,
    accessCode: order.accessCode ?? null,
    returnTo: order.returnTo,
    expiresAtMs: order.grantEndMs ?? null,
    reviewReason: order.reviewReason ?? null,
    createdAtMs: order.createdAtMs,
  };
}

export const currentOrder = query({
  args: { reference: v.optional(v.string()) },
  returns: v.union(clientOrderValidator, v.null()),
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    const account = await ctx.db
      .query("proAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const order = args.reference
      ? await ctx.db
          .query("proOrders")
          .withIndex("by_reference", (q) => q.eq("reference", args.reference!))
          .unique()
      : account?.activeOrderId
        ? await ctx.db.get(account.activeOrderId)
        : null;
    return order?.userId === userId ? clientOrder(order) : null;
  },
});

export const getOrder = internalQuery({
  args: { id: v.id("proOrders") },
  returns: v.union(orderDoc, v.null()),
  handler: async (ctx, args): Promise<Doc<"proOrders"> | null> =>
    ctx.db.get(args.id),
});

export const ownedOrderId = internalQuery({
  args: { reference: v.string(), admin: v.optional(v.boolean()) },
  returns: v.union(v.id("proOrders"), v.null()),
  handler: async (ctx, args) => {
    const userId = args.admin
      ? await requireAdmin(ctx)
      : await requireVerifiedAuthUserId(ctx);
    const order = await ctx.db
      .query("proOrders")
      .withIndex("by_reference", (q) => q.eq("reference", args.reference))
      .unique();
    return order && (args.admin || order.userId === userId) ? order._id : null;
  },
});

export const claimVerification = internalMutation({
  args: { id: v.id("proOrders") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.id);
    const now = Date.now();
    if (
      !order ||
      (order.verificationLeaseUntilMs ?? 0) > now ||
      (order.lastCheckedAtMs ?? 0) > now - 10_000
    )
      return false;
    await ctx.db.patch(args.id, {
      verificationLeaseUntilMs: now + 60_000,
      lastCheckedAtMs: now,
    });
    return true;
  },
});

export const recordVerification = internalMutation({
  args: {
    id: v.id("proOrders"),
    transaction: v.any(),
    mode: v.union(v.literal("test"), v.literal("live")),
    error: v.optional(v.string()),
    financialReview: v.optional(v.string()),
    financialChecked: v.optional(v.boolean()),
    financialHoldDigest: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.id);
    if (!order) return null;
    const now = Date.now();
    if (!(await ctx.db.get(order.userId))) {
      await ctx.db.patch(order._id, {
        verificationLeaseUntilMs: 0,
        status: "review",
        reviewReason:
          "Account was deleted before payment reconciliation completed. Operator review/refund may be required.",
        nextCheckAtMs: CLOSED,
        updatedAtMs: now,
      });
      return null;
    }
    const data = args.transaction;
    const checks = order.checks + 1;
    const retryAt =
      now + Math.min(6 * 3600_000, 30_000 * 2 ** Math.min(checks, 10));
    const checkPatch = {
      checks,
      verificationLeaseUntilMs: 0,
      nextCheckAtMs: retryAt,
      updatedAtMs: now,
    };
    if (!data || args.error) {
      // An outage must not erase a signed refund/dispute hold.
      const financialHold =
        order.reviewReason?.startsWith("refund.") ||
        order.reviewReason?.startsWith("charge.dispute");
      await ctx.db.patch(order._id, {
        ...checkPatch,
        reviewReason: financialHold
          ? order.reviewReason
          : "Provider verification unavailable. Access will update when verification completes.",
      });
      return null;
    }
    if (args.financialReview) {
      await ctx.db.patch(order._id, {
        ...checkPatch,
        status: "review",
        reviewReason: args.financialReview,
        nextCheckAtMs: now + 24 * 3600_000,
      });
      if (order.grantEndMs) await recomputeEntitlement(ctx, order.userId);
      await notify(
        ctx,
        order,
        "review",
        "Your Poscal Pro payment needs review",
        "A refund or dispute needs checking. Your saved data remains available. Contact payment support with this reference.",
      );
      return null;
    }
    if (
      (!args.financialChecked ||
        order.financialHoldDigest !== args.financialHoldDigest) &&
      (order.reviewReason?.startsWith("refund.") ||
        order.reviewReason?.startsWith("charge.dispute"))
    ) {
      // A verification started before a newer signed hold cannot restore access.
      await ctx.db.patch(order._id, {
        ...checkPatch,
        nextCheckAtMs:
          order.financialHoldDigest !== args.financialHoldDigest
            ? now + 10_000
            : CLOSED,
      });
      return null;
    }
    const matches =
      order.mode === args.mode &&
      verifyTransactionMatch(data, order, args.mode);
    if (matches) {
      const sameTransaction = await ctx.db
        .query("proOrders")
        .withIndex("by_provider_id", (q) =>
          q.eq("providerTransactionId", String(data.id)),
        )
        .unique();
      if (sameTransaction && sameTransaction._id !== order._id) {
        await ctx.db.patch(order._id, {
          ...checkPatch,
          status: "review",
          reviewReason:
            "Provider transaction ID is already assigned to another payment",
        });
        await notify(
          ctx,
          order,
          "review",
          "Your Poscal Pro payment needs review",
          "Payment details need checking before access can be confirmed. Contact support with this reference.",
        );
        return null;
      }
      if (
        order.grantEndMs &&
        order.status === "review" &&
        args.financialChecked
      ) {
        await ctx.db.patch(order._id, {
          ...checkPatch,
          status: "paid",
          reviewReason: undefined,
          financialHoldDigest: undefined,
          nextCheckAtMs: now + 24 * 3600_000,
        });
        await recomputeEntitlement(ctx, order.userId);
        return null;
      }
      if (order.status === "paid" || order.status === "reversed") {
        await ctx.db.patch(order._id, {
          ...checkPatch,
          nextCheckAtMs: order.status === "paid" ? now + 24 * 3600_000 : CLOSED,
        });
        return null;
      }
      // No success transition is possible on a client callback or API-level status.
      const account = await accountFor(ctx, order.userId);
      const paidAt = Date.parse(data.paid_at ?? "");
      if (!Number.isFinite(paidAt) || paidAt > now + 5 * 60_000) {
        await ctx.db.patch(order._id, {
          ...checkPatch,
          status: "review",
          reviewReason: "Provider payment timestamp requires review",
        });
        await notify(
          ctx,
          order,
          "review",
          "Your Poscal Pro payment needs review",
          "Payment details need checking before access can be confirmed. Contact support with this reference.",
        );
        return null;
      }
      const start = Math.max(account.expiresAtMs, now);
      const end = addPlanPeriod(start, order.plan);
      await ctx.db.patch(order._id, {
        ...checkPatch,
        status: "paid",
        providerStatus: "success",
        providerTransactionId: String(data.id),
        paidAtMs: paidAt,
        activatedAtMs: now,
        grantStartMs: start,
        grantEndMs: end,
        reviewReason: undefined,
        financialHoldDigest: undefined,
        couponReservationActive: false,
        nextCheckAtMs: now + 24 * 3600_000,
      });
      const authorization = data.authorization;
      const canEnableAutoRenew =
        order.source !== "auto_renew" &&
        order.autoRenewRequested === true &&
        authorization?.reusable === true &&
        typeof authorization.authorization_code === "string" &&
        authorization.authorization_code.startsWith("AUTH_") &&
        typeof authorization.signature === "string" &&
        authorization.signature.length > 3;

      const renewalPatch =
        order.source === "auto_renew" && account.autoRenewEnabled
          ? {
              autoRenewNextChargeAtMs: Math.max(now + 60_000, end - 24 * 3600_000),
              autoRenewFailureCount: 0,
              autoRenewLeaseUntilMs: 0,
              autoRenewOrderId: undefined,
            }
          : canEnableAutoRenew
            ? {
                autoRenewEnabled: true,
                autoRenewPlan: order.plan,
                autoRenewAuthorizationCode: authorization!.authorization_code!,
                autoRenewEmail: order.email,
                autoRenewSignature: authorization!.signature!,
                autoRenewChannel: authorization!.channel ?? "card",
                autoRenewLast4: authorization!.last4,
                autoRenewBrand:
                  authorization!.brand ?? authorization!.card_type,
                autoRenewBank: authorization!.bank,
                autoRenewExpMonth: authorization!.exp_month,
                autoRenewExpYear: authorization!.exp_year,
                autoRenewCountryCode: authorization!.country_code,
                autoRenewNextChargeAtMs: Math.max(now + 60_000, end - 24 * 3600_000),
                autoRenewFailureCount: 0,
                autoRenewLeaseUntilMs: 0,
                autoRenewConsentAtMs: now,
                autoRenewConsentVersion: 1,
              }
            : order.source === "checkout" &&
                account.autoRenewEnabled &&
                !order.autoRenewRequested
              ? {
                  autoRenewNextChargeAtMs: Math.max(now + 60_000, end - 24 * 3600_000),
                  autoRenewFailureCount: 0,
                  autoRenewLeaseUntilMs: 0,
                }
              : order.autoRenewRequested
                ? {
                    autoRenewEnabled: false,
                    autoRenewNextChargeAtMs: undefined,
                    autoRenewLeaseUntilMs: 0,
                    autoRenewOrderId: undefined,
                    ...clearAutoRenewPaymentMethod(),
                  }
                : {};

      await ctx.db.patch(account._id, {
        expiresAtMs: end,
        paymentMode: args.mode,
        hasPaidBefore: true,
        activeOrderId:
          account.activeOrderId === order._id
            ? undefined
            : account.activeOrderId,
        freeJournalChosen: false,
        ...renewalPatch,
        updatedAtMs: now,
      });
      if (order.couponId) {
        const coupon = await ctx.db.get(order.couponId);
        if (coupon)
          await ctx.db.patch(coupon._id, {
            reservedUses: Math.max(
              0,
              coupon.reservedUses - (order.couponReservationActive ? 1 : 0),
            ),
            redeemedUses: coupon.redeemedUses + 1,
          });
      }
      const granted = (await ctx.db.get(order._id))!;
      await notify(
        ctx,
        granted,
        "paid",
        "Poscal Pro is active",
        `Payment confirmed. Your Pro access ends on ${new Date(end).toISOString().slice(0, 10)}. ${canEnableAutoRenew || (order.source === "auto_renew" && account.autoRenewEnabled) ? "Auto-renew is on and the next charge is scheduled before expiry." : "You will not be charged automatically."}`,
      );
      await ctx.scheduler.runAt(
        Math.max(now, end - 24 * 3600_000),
        internal.proBilling.expiryNotice,
        { id: order._id, end, expired: false },
      );
      await ctx.scheduler.runAt(
        Math.max(now, end),
        internal.proBilling.expiryNotice,
        { id: order._id, end, expired: true },
      );
      return null;
    }
    // Any success with the wrong amount/currency/order/environment is quarantined.
    if (
      data.status === "success" ||
      data.reference !== order.reference ||
      data.domain !== args.mode
    ) {
      await ctx.db.patch(order._id, {
        ...checkPatch,
        status: "review",
        reviewReason:
          "Provider and order details disagree. Support review required.",
      });
      // If a previously paid record becomes inconsistent, withdraw only its grant.
      if (order.status === "paid")
        await recomputeEntitlement(ctx, order.userId);
      await notify(
        ctx,
        order,
        "review",
        "Your Poscal Pro payment needs review",
        "Provider and order details disagree. Your data is safe. Contact payment support before trying another payment.",
      );
      return null;
    }
    const terminal = ["failed", "abandoned", "reversed"].includes(data.status);
    if (terminal) {
      const status = data.status as "failed" | "abandoned" | "reversed";
      await ctx.db.patch(order._id, {
        ...checkPatch,
        status,
        providerStatus: status,
        nextCheckAtMs: order.status === "paid" ? retryAt : now + 6 * 3600_000,
      });
      if (order.status === "paid")
        await recomputeEntitlement(ctx, order.userId);
      if (order.couponId && order.couponReservationActive) {
        const coupon = await ctx.db.get(order.couponId);
        if (coupon)
          await ctx.db.patch(coupon._id, {
            reservedUses: Math.max(0, coupon.reservedUses - 1),
          });
        await ctx.db.patch(order._id, { couponReservationActive: false });
      }
      if (order.source === "auto_renew") {
        const account = await accountFor(ctx, order.userId);
        const failures = (account.autoRenewFailureCount ?? 0) + 1;
        const retrying =
          failures < 3 && account.autoRenewEnabled === true;
        await ctx.db.patch(account._id, {
          autoRenewFailureCount: failures,
          autoRenewLeaseUntilMs: 0,
          autoRenewOrderId: undefined,
          autoRenewEnabled: retrying,
          autoRenewNextChargeAtMs: retrying
            ? now + 12 * 3600_000
            : undefined,
          ...(retrying ? {} : clearAutoRenewPaymentMethod()),
          updatedAtMs: now,
        });
      }
      if (status !== "abandoned" || order.reminders)
        await notify(
          ctx,
          order,
          status,
          status === "abandoned"
            ? "Continue your Poscal Pro checkout"
            : status === "reversed"
              ? "Your Poscal Pro payment was reversed"
              : "Your Poscal Pro payment failed",
          status === "abandoned"
            ? "Your checkout was not completed. You can review it in Poscal."
            : "We did not confirm a successful payment. Check your payment reference before trying again.",
        );
    } else {
      await ctx.db.patch(order._id, {
        ...checkPatch,
        providerStatus: String(data.status),
        status: order.status === "paid" ? "review" : "pending",
      });
      if (order.status === "paid")
        await recomputeEntitlement(ctx, order.userId);
    }
    // Reconcile terminal orders for 72h to catch delayed success, then stop polling.
    if (terminal && now - order.createdAtMs > 72 * 3600_000)
      await ctx.db.patch(order._id, { nextCheckAtMs: CLOSED });
    return null;
  },
});

async function recomputeEntitlement(ctx: MutationCtx, userId: Id<"users">) {
  if (!(await ctx.db.get(userId))) return;
  const orders = await ctx.db
    .query("proOrders")
    .withIndex("by_user_created", (q) => q.eq("userId", userId))
    .take(201);
  // Never silently use a truncated financial ledger.
  if (orders.length > 200)
    throw new Error(
      "Ledger exceeds automatic recovery limit. Manual review required.",
    );
  const account = await accountFor(ctx, userId);
  let expires = account.legacyExpiresAtMs ?? 0;
  let last: Doc<"proOrders"> | null = null;
  for (const order of orders
    .filter((o) => o.status === "paid")
    .sort((a, b) => (a.paidAtMs ?? 0) - (b.paidAtMs ?? 0))) {
    const start = Math.max(expires, order.activatedAtMs ?? order.paidAtMs!);
    expires = addPlanPeriod(start, order.plan);
    if (order.grantStartMs !== start || order.grantEndMs !== expires)
      await ctx.db.patch(order._id, {
        grantStartMs: start,
        grantEndMs: expires,
      });
    last = order;
  }
  if (last && account.expiresAtMs !== expires) {
    await ctx.scheduler.runAt(
      Math.max(Date.now(), expires - 24 * 3600_000),
      internal.proBilling.expiryNotice,
      { id: last._id, end: expires, expired: false },
    );
    await ctx.scheduler.runAt(
      Math.max(Date.now(), expires),
      internal.proBilling.expiryNotice,
      { id: last._id, end: expires, expired: true },
    );
  }
  await ctx.db.patch(account._id, {
    expiresAtMs: expires,
    paymentMode: last?.mode ?? account.paymentMode,
    updatedAtMs: Date.now(),
  });
}

export const expiryNotice = internalMutation({
  args: { id: v.id("proOrders"), end: v.number(), expired: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.id);
    if (!order || order.status !== "paid") return null;
    const account = await ctx.db
      .query("proAccounts")
      .withIndex("by_user", (q) => q.eq("userId", order.userId))
      .unique();
    if (account?.expiresAtMs !== args.end) return null; // Superseded renewal.
    if (args.expired && account)
      await ctx.db.patch(account._id, { updatedAtMs: Date.now() });
    await notify(
      ctx,
      order,
      args.expired ? "expired" : "expiring",
      args.expired
        ? "Your Poscal Pro access has ended"
        : "Poscal Pro ends tomorrow",
      args.expired
        ? "Your data is safe. Free limits apply when billing is enabled. Renew Pro to unlock extra journals, uploads and analytics."
        : "Renew when you are ready. There is no automatic charge.",
    );
    return null;
  },
});

export const notificationStillRelevant = internalQuery({
  args: { id: v.id("proOrders"), kind: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.id);
    if (!order) return false;
    if (args.kind === "unfinished")
      return (
        order.reminders &&
        ["initializing", "pending", "review"].includes(order.status)
      );
    if (args.kind === "pending")
      return ["initializing", "pending", "review"].includes(order.status);
    if (
      ["paid", "failed", "abandoned", "reversed", "review"].includes(args.kind)
    )
      return order.status === args.kind;
    const account = await ctx.db
      .query("proAccounts")
      .withIndex("by_user", (q) => q.eq("userId", order.userId))
      .unique();
    return (
      order.status === "paid" &&
      account?.expiresAtMs === order.grantEndMs &&
      (args.kind !== "expired" ||
        (account?.expiresAtMs ?? Infinity) <= Date.now())
    );
  },
});

export const captureWebhook = internalMutation({
  args: {
    digest: v.string(),
    event: v.string(),
    reference: v.optional(v.string()),
    providerId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (
      await ctx.db
        .query("proWebhookEvents")
        .withIndex("by_digest", (q) => q.eq("digest", args.digest))
        .unique()
    )
      return null;
    const order = args.reference
      ? await ctx.db
          .query("proOrders")
          .withIndex("by_reference", (q) => q.eq("reference", args.reference!))
          .unique()
      : args.providerId
        ? await ctx.db
            .query("proOrders")
            .withIndex("by_provider_id", (q) =>
              q.eq("providerTransactionId", args.providerId),
            )
            .unique()
        : null;
    await ctx.db.insert("proWebhookEvents", {
      digest: args.digest,
      event: args.event,
      reference: args.reference,
      orderId: order?._id,
      providerId: args.providerId,
      createdAtMs: Date.now(),
    });
    if (order) {
      if (
        args.event === "refund.processed" ||
        args.event.startsWith("charge.dispute.")
      ) {
        // Refunded transactions can still verify as success. Never ignore this event.
        // Freeze this grant and require operator confirmation against refund/dispute APIs.
        await ctx.db.patch(order._id, {
          status: "review",
          reviewReason: `${args.event}: verify refund/dispute before restoring access`,
          financialHoldDigest: args.digest,
          nextCheckAtMs: Date.now(),
        });
        await recomputeEntitlement(ctx, order.userId);
        await ctx.scheduler.runAfter(0, internal.proPayments.reconcileOrder, {
          id: order._id,
        });
        await notify(
          ctx,
          order,
          "review",
          "Your Poscal Pro payment needs review",
          "A refund or dispute is being checked. Your saved data remains available. Contact payment support with this reference.",
        );
      } else {
        await ctx.db.patch(order._id, { nextCheckAtMs: Date.now() });
        await ctx.scheduler.runAfter(0, internal.proPayments.reconcileOrder, {
          id: order._id,
        });
      }
    }
    return null;
  },
});

export const setAutoRenew = mutation({
  args: {
    enabled: v.boolean(),
    plan: v.optional(planValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    const account = await accountFor(ctx, userId);
    const now = Date.now();

    if (!args.enabled) {
      await ctx.db.patch(account._id, {
        autoRenewEnabled: false,
        autoRenewNextChargeAtMs: undefined,
        autoRenewLeaseUntilMs: 0,
        autoRenewOrderId: undefined,
        ...clearAutoRenewPaymentMethod(),
        updatedAtMs: now,
      });
      return null;
    }

    if (
      !account.autoRenewAuthorizationCode ||
      !account.autoRenewEmail ||
      !account.autoRenewSignature
    ) {
      throw new Error(
        "Make a payment with auto-renew selected before enabling automatic renewal.",
      );
    }
    if (account.expiresAtMs <= now) {
      throw new Error("Renew Pro manually before enabling auto-renew.");
    }

    await ctx.db.patch(account._id, {
      autoRenewEnabled: true,
      autoRenewPlan: args.plan ?? account.autoRenewPlan ?? "monthly",
      autoRenewNextChargeAtMs: Math.max(
        now + 60_000,
        account.expiresAtMs - 24 * 3600_000,
      ),
      autoRenewFailureCount: 0,
      autoRenewLeaseUntilMs: 0,
      autoRenewConsentAtMs: now,
      autoRenewConsentVersion: 1,
      updatedAtMs: now,
    });
    return null;
  },
});

export const dueAutoRenewAccounts = internalQuery({
  args: {},
  returns: v.array(v.id("proAccounts")),
  handler: async (ctx) =>
    (
      await ctx.db
        .query("proAccounts")
        .withIndex("by_auto_renew_due", (q) =>
          q.eq("autoRenewEnabled", true).lte("autoRenewNextChargeAtMs", Date.now()),
        )
        .take(10)
    ).map((row) => row._id),
});

export const claimAutoRenew = internalMutation({
  args: { id: v.id("proAccounts") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.id);
    const now = Date.now();
    const billing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", PRO_LOCK_KEY))
      .unique();
    if (account && now > account.expiresAtMs + 48 * 3600_000) {
      await ctx.db.patch(account._id, {
        autoRenewEnabled: false,
        autoRenewNextChargeAtMs: undefined,
        autoRenewLeaseUntilMs: 0,
        autoRenewOrderId: undefined,
        ...clearAutoRenewPaymentMethod(),
        updatedAtMs: now,
      });
      return false;
    }
    if (
      billing?.valueBoolean !== true ||
      !account ||
      account.autoRenewEnabled !== true ||
      !account.autoRenewNextChargeAtMs ||
      account.autoRenewNextChargeAtMs > now ||
      (account.autoRenewLeaseUntilMs ?? 0) > now ||
      !account.autoRenewAuthorizationCode ||
      !account.autoRenewEmail ||
      !account.autoRenewPlan
    )
      return false;
    await ctx.db.patch(account._id, {
      autoRenewLeaseUntilMs: now + 5 * 60_000,
      updatedAtMs: now,
    });
    return true;
  },
});

export const prepareAutoRenewOrder = internalMutation({
  args: { id: v.id("proAccounts") },
  returns: orderDoc,
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.id);
    if (
      !account ||
      account.autoRenewEnabled !== true ||
      !account.autoRenewAuthorizationCode ||
      !account.autoRenewEmail ||
      !account.autoRenewPlan
    )
      throw new Error("Auto-renew is not ready");

    if (account.autoRenewOrderId) {
      const existing = await ctx.db.get(account.autoRenewOrderId);
      if (
        existing &&
        ["initializing", "pending", "review"].includes(existing.status)
      )
        return existing;
    }

    const now = Date.now();
    const amount = PRICES[account.autoRenewPlan];
    const id = await ctx.db.insert("proOrders", {
      userId: account.userId,
      email: account.autoRenewEmail,
      reference: "",
      plan: account.autoRenewPlan,
      mode: process.env.PRO_PAYMENT_MODE as "test" | "live",
      amount,
      baseAmount: amount,
      currency: "NGN",
      status: "pending",
      returnTo: "/pro",
      reminders: false,
      source: "auto_renew",
      autoRenewRequested: true,
      nextCheckAtMs: now + 60_000,
      checks: 0,
      createdAtMs: now,
      updatedAtMs: now,
    });
    await ctx.db.patch(id, { reference: `ppro-auto-${id}` });
    await ctx.db.patch(account._id, {
      autoRenewOrderId: id,
      autoRenewNextChargeAtMs: now + 12 * 3600_000,
      updatedAtMs: now,
    });
    return (await ctx.db.get(id))!;
  },
});

export const autoRenewChargeFailed = internalMutation({
  args: { id: v.id("proAccounts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.id);
    if (!account) return null;
    const now = Date.now();
    const failures = (account.autoRenewFailureCount ?? 0) + 1;
    const retrying = failures < 3 && account.autoRenewEnabled === true;
    await ctx.db.patch(account._id, {
      autoRenewFailureCount: failures,
      autoRenewLeaseUntilMs: 0,
      autoRenewOrderId: undefined,
      autoRenewEnabled: retrying,
      autoRenewNextChargeAtMs: retrying
        ? now + 12 * 3600_000
        : undefined,
      ...(retrying ? {} : clearAutoRenewPaymentMethod()),
      updatedAtMs: now,
    });
    return null;
  },
});

export const getAutoRenewAccount = internalQuery({
  args: { id: v.id("proAccounts") },
  returns: v.any(),
  handler: async (ctx, args) => ctx.db.get(args.id),
});

export const dueOrders = internalQuery({
  args: {},
  returns: v.array(v.id("proOrders")),
  handler: async (ctx) =>
    (
      await ctx.db
        .query("proOrders")
        .withIndex("by_due", (q) => q.lte("nextCheckAtMs", Date.now()))
        .take(25)
    ).map((o) => o._id),
});

export const setEnabled = mutation({
  args: { enabled: v.boolean(), confirmLaunch: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    if (args.enabled) {
      if (!args.confirmLaunch)
        throw new Error("Confirm the end of beta and Free limits first");
      if (!gatewayReady())
        throw new Error(
          "Configure and test the gateway, email and push credentials before launch",
        );
      const legacy = await ctx.db.query("paymentRecords").take(1);
      if (legacy.length)
        throw new Error(
          "Archive and independently verify the legacy payment ledger before launching. See the billing migration runbook.",
        );
    }
    const setting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", PRO_LOCK_KEY))
      .unique();
    const patch = {
      valueBoolean: args.enabled,
      updatedAtMs: Date.now(),
      updatedByUserId: actor,
    };
    if (setting) await ctx.db.patch(setting._id, patch);
    else await ctx.db.insert("appSettings", { key: PRO_LOCK_KEY, ...patch });
    await ctx.db.insert("proBillingAudit", {
      actor,
      action: args.enabled ? "billing_enabled" : "billing_disabled",
      detail: "Pro policy v1",
      createdAtMs: Date.now(),
    });
    return null;
  },
});

export const adminOverview = query({
  args: {},
  returns: v.object({
    enabled: v.boolean(),
    ready: v.boolean(),
    legacyPresent: v.boolean(),
    orders: v.array(orderDoc),
    coupons: v.array(couponDoc),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const setting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", PRO_LOCK_KEY))
      .unique();
    return {
      enabled: setting?.valueBoolean === true,
      ready: gatewayReady(),
      legacyPresent: !!(await ctx.db.query("paymentRecords").take(1)).length,
      orders: await ctx.db.query("proOrders").order("desc").take(25),
      coupons: await ctx.db.query("proCoupons").order("desc").take(50),
    };
  },
});

export const orderHistory = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(clientOrderValidator),
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    const page = await ctx.db
      .query("proOrders")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .paginate(args.paginationOpts);
    return { ...page, page: page.page.map(clientOrder) };
  },
});

export const createCoupon = mutation({
  args: {
    code: v.string(),
    percentOff: v.number(),
    validUntilMs: v.number(),
    maxUses: v.number(),
    firstPurchaseOnly: v.boolean(),
    betaUsersOnly: v.boolean(),
    plan: v.optional(planValidator),
  },
  returns: v.id("proCoupons"),
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const code = args.code.trim().toUpperCase();
    discountAmount(10000, args.percentOff);
    if (
      !/^[A-Z0-9_-]{3,32}$/.test(code) ||
      !Number.isFinite(args.validUntilMs) ||
      !Number.isInteger(args.maxUses) ||
      args.maxUses < 1 ||
      args.maxUses > 100000 ||
      args.validUntilMs <= Date.now()
    )
      throw new Error("Invalid discount settings");
    if (
      await ctx.db
        .query("proCoupons")
        .withIndex("by_code", (q) => q.eq("code", code))
        .unique()
    )
      throw new Error("Code already exists");
    const id = await ctx.db.insert("proCoupons", {
      ...args,
      code,
      enabled: true,
      reservedUses: 0,
      redeemedUses: 0,
      betaCutoffMs: Date.now(),
      createdAtMs: Date.now(),
      createdBy: actor,
    });
    await ctx.db.insert("proBillingAudit", {
      actor,
      action: "coupon_created",
      detail: code,
      createdAtMs: Date.now(),
    });
    return id;
  },
});

export const toggleCoupon = mutation({
  args: { id: v.id("proCoupons"), enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const coupon = await ctx.db.get(args.id);
    if (!coupon) throw new Error("Code not found");
    await ctx.db.patch(args.id, { enabled: args.enabled });
    await ctx.db.insert("proBillingAudit", {
      actor,
      action: "coupon_toggled",
      detail: `${coupon.code}: ${args.enabled}`,
      createdAtMs: Date.now(),
    });
    return null;
  },
});

/** Admin-only migration input. No historical ledger status can grant access. */
export const legacyBatch = internalQuery({
  args: {},
  returns: v.object({ actor: v.id("users"), rows: v.array(v.any()) }),
  handler: async (ctx) => ({
    actor: await requireAdmin(ctx),
    rows: await ctx.db.query("paymentRecords").take(20),
  }),
});

export const archiveLegacy = internalMutation({
  args: {
    sourceId: v.id("paymentRecords"),
    actor: v.id("users"),
    transaction: v.any(),
    mode: v.union(v.literal("test"), v.literal("live")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if ((await requireAdmin(ctx)) !== args.actor)
      throw new Error("Admin identity changed");
    const source = await ctx.db.get(args.sourceId);
    if (!source) return null;
    if (
      await ctx.db
        .query("proLegacyPayments")
        .withIndex("by_source", (q) => q.eq("sourceId", source._id))
        .unique()
    )
      throw new Error("Legacy archive conflict; inspect before deleting");
    const data = args.transaction;
    const match = /^psk_(.+)_(monthly|yearly)_\d+$/.exec(source.reference);
    if (
      data?.reference !== source.reference ||
      data?.domain !== args.mode ||
      !["success", "failed", "abandoned", "reversed"].includes(data?.status)
    )
      throw new Error(
        "Legacy payment identity/status requires operator review",
      );
    const userId = ctx.db.normalizeId("users", source.userId);
    const expectedAmount = match?.[2] === "monthly" ? 500 : 5880;
    const verified =
      !!userId &&
      !!(await ctx.db.get(userId)) &&
      source.status === "success" &&
      data?.status === "success" &&
      data.reference === source.reference &&
      data.domain === args.mode &&
      data.currency === "USD" &&
      source.currency === "USD" &&
      source.amount === expectedAmount &&
      data.amount === expectedAmount &&
      match?.[1] === source.userId &&
      data.metadata?.userId === source.userId &&
      data.metadata?.planId === match?.[2];
    const paidAt = Date.parse(data?.paid_at ?? "");
    if (
      data?.status === "success" &&
      (!verified ||
        !Number.isFinite(paidAt) ||
        paidAt > Date.now() + 5 * 60_000 ||
        (source.expiresAtMs != null && !Number.isFinite(source.expiresAtMs)))
    )
      throw new Error("Legacy payment mismatch requires operator review");
    const legacyEnd = Number.isFinite(paidAt)
      ? paidAt + (match?.[2] === "monthly" ? 30 : 365) * 86400_000
      : 0;
    const expires = Math.min(source.expiresAtMs ?? legacyEnd, legacyEnd);
    await ctx.db.insert("proLegacyPayments", {
      sourceId: source._id,
      source,
      reference: source.reference,
      verification: verified ? "verified" : "rejected",
      verifiedExpiresAtMs: verified ? expires : undefined,
      archivedAtMs: Date.now(),
      actor: args.actor,
    });
    if (verified && userId) {
      const account = await accountFor(ctx, userId);
      await ctx.db.patch(account._id, {
        legacyExpiresAtMs: Math.max(
          account.legacyPaymentMode === args.mode
            ? (account.legacyExpiresAtMs ?? 0)
            : 0,
          expires,
        ),
        legacyPaymentMode: args.mode,
        paymentMode: args.mode,
        expiresAtMs: Math.max(
          account.paymentMode === args.mode ? account.expiresAtMs : 0,
          expires,
        ),
        hasPaidBefore: true,
        updatedAtMs: Date.now(),
      });
    }
    // Archive and replacement access commit before the original ledger row disappears.
    await ctx.db.delete(source._id);
    await ctx.db.insert("proBillingAudit", {
      actor: args.actor,
      action: "legacy_payment_archived",
      detail: `${source.reference}: ${verified ? "verified" : "rejected"}`,
      createdAtMs: Date.now(),
    });
    return null;
  },
});

export const startLegacyCleanup = internalMutation({
  args: { actor: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    if ((await ctx.db.query("paymentRecords").take(1)).length)
      throw new Error("Finish ledger migration first");
    const oldFlag = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "signals_paid_lock_enabled"))
      .unique();
    if (oldFlag) await ctx.db.delete(oldFlag._id);
    for (const table of ["users", "profiles"] as const)
      await ctx.scheduler.runAfter(0, internal.proBilling.cleanLegacyFields, {
        table,
        cursor: null,
      });
    await ctx.db.insert("proBillingAudit", {
      actor: args.actor,
      action: "legacy_field_cleanup_started",
      detail:
        "Backed-up ledger migrated; deleting deprecated fields in bounded batches",
      createdAtMs: Date.now(),
    });
    return null;
  },
});

export const cleanLegacyFields = internalMutation({
  args: {
    table: v.union(v.literal("users"), v.literal("profiles")),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query(args.table)
      .paginate({ cursor: args.cursor, numItems: 50 });
    for (const row of page.page)
      await ctx.db.patch(row._id, {
        paymentStatus: undefined,
        subscriptionTier: undefined,
        subscriptionExpiresAtMs: undefined,
      });
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.proBilling.cleanLegacyFields, {
        table: args.table,
        cursor: page.continueCursor,
      });
    return null;
  },
});

export const unfinishedNotice = internalMutation({
  args: { id: v.id("proOrders") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.id);
    if (
      order?.reminders &&
      ["initializing", "pending", "review"].includes(order.status)
    )
      await notify(
        ctx,
        order,
        "unfinished",
        "Your Poscal Pro checkout is saved",
        "Check your payment status in Poscal to continue. If you were debited, do not start another payment while confirmation is pending.",
      );
    return null;
  },
});
