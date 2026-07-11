import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { internalMutation, mutation, query } from "./_generated/server";

const nullableStringArg = v.optional(v.union(v.string(), v.null()));
const nullableNumberArg = v.optional(v.union(v.number(), v.null()));
const nullableAnyArg = v.optional(v.union(v.any(), v.null()));
const PAID_LOCK_KEY = "signals_paid_lock_enabled";
const INGESTOR_HEALTH_KEY = "primary";

const isElevatedRole = (role?: string | null) => role === "admin" || role === "super_admin";

const requireAdmin = async (ctx: any) => {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");

  const user = await ctx.db.get(userId);
  if (!user) throw new Error("User not found");

  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_external_user_id", (q: any) => q.eq("externalUserId", userId))
    .first();

  const role = profile?.role ?? user.role ?? "user";
  if (!isElevatedRole(role)) {
    throw new Error("Admin access required");
  }

  return { userId, user, profile, role };
};

export const requireAdminForInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAdmin(ctx);
    return { userId };
  },
});

export const getPaidLock = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", PAID_LOCK_KEY))
      .unique();

    return row?.valueBoolean ?? false;
  },
});

export const setPaidLock = mutation({
  args: {
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", PAID_LOCK_KEY))
      .unique();

    const payload = {
      key: PAID_LOCK_KEY,
      valueBoolean: args.enabled,
      valueString: null,
      valueNumber: null,
      updatedAtMs: Date.now(),
      updatedByUserId: userId,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("appSettings", payload);
    }

    return args.enabled;
  },
});

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("profiles").collect();

    return rows
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
      .map((row) => ({
        id: row.externalUserId,
        full_name: row.fullName ?? null,
        email: row.email,
        is_admin: isElevatedRole(row.role ?? "user"),
        account_type: row.role ?? "user",
        created_at: new Date(row.createdAtMs).toISOString(),
        subscription_tier: row.subscriptionTier ?? "free",
        subscription_end: row.subscriptionExpiresAtMs ? new Date(row.subscriptionExpiresAtMs).toISOString() : null,
      }));
  },
});

export const listAppUpdates = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("appUpdates")
      .withIndex("by_created")
      .order("desc")
      .collect();

    return rows.map((row) => ({
      id: row._id,
      title: row.title,
      description: row.description,
      is_active: row.isActive,
      created_at: new Date(row.createdAtMs).toISOString(),
    }));
  },
});

export const createAppUpdate = mutation({
  args: {
    title: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const now = Date.now();

    const id = await ctx.db.insert("appUpdates", {
      title: args.title,
      description: args.description,
      isActive: true,
      createdAtMs: now,
      updatedAtMs: now,
      createdByUserId: userId,
    });

    return {
      id,
      title: args.title,
      description: args.description,
      is_active: true,
      created_at: new Date(now).toISOString(),
    };
  },
});

export const deleteAppUpdate = mutation({
  args: {
    id: v.id("appUpdates"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

export const updateAppUpdate = mutation({
  args: {
    id: v.id("appUpdates"),
    title: nullableStringArg,
    description: nullableStringArg,
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Update not found");

    await ctx.db.patch(args.id, {
      title: args.title ?? existing.title,
      description: args.description ?? existing.description,
      isActive: args.isActive ?? existing.isActive,
      updatedAtMs: Date.now(),
    });

    const row = await ctx.db.get(args.id);
    return {
      id: row!._id,
      title: row!.title,
      description: row!.description,
      is_active: row!.isActive,
      created_at: new Date(row!.createdAtMs).toISOString(),
    };
  },
});

export const getIngestorHealth = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const row = await ctx.db
      .query("ingestorHealth")
      .withIndex("by_key", (q) => q.eq("key", INGESTOR_HEALTH_KEY))
      .unique();

    return {
      recent_401_count: row?.recent401Count ?? 0,
      last_401_at: row?.last401AtMs ? new Date(row.last401AtMs).toISOString() : null,
      last_flush_at: row?.lastFlushAtMs ? new Date(row.lastFlushAtMs).toISOString() : null,
      backend_reachable: row?.backendReachable ?? false,
    };
  },
});

export const upsertIngestorHealth = mutation({
  args: {
    recent401Count: v.number(),
    last401AtMs: nullableNumberArg,
    lastFlushAtMs: nullableNumberArg,
    backendReachable: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("ingestorHealth")
      .withIndex("by_key", (q) => q.eq("key", INGESTOR_HEALTH_KEY))
      .unique();

    const payload = {
      key: INGESTOR_HEALTH_KEY,
      recent401Count: args.recent401Count,
      last401AtMs: args.last401AtMs ?? null,
      lastFlushAtMs: args.lastFlushAtMs ?? null,
      backendReachable: args.backendReachable,
      updatedAtMs: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("ingestorHealth", payload);
  },
});

export const subscribePush = mutation({
  args: {
    endpoint: v.string(),
    p256dhKey: v.string(),
    authKey: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .unique();

    const payload = {
      userId: userId ?? null,
      endpoint: args.endpoint,
      p256dhKey: args.p256dhKey,
      authKey: args.authKey,
      isActive: true,
      updatedAtMs: Date.now(),
      lastVerifiedAtMs: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("pushSubscriptions", {
      ...payload,
      createdAtMs: Date.now(),
    });
  },
});

export const listPushSubscriptions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const rows = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return rows
      .filter((row) => row.isActive)
      .map((row) => ({
        id: row._id,
        endpoint: row.endpoint,
        p256dh_key: row.p256dhKey,
        auth_key: row.authKey,
        created_at: new Date(row.createdAtMs).toISOString(),
      }));
  },
});

export const unsubscribePush = mutation({
  args: {
    endpoint: nullableStringArg,
    id: v.optional(v.id("pushSubscriptions")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const target = args.id
      ? await ctx.db.get(args.id)
      : args.endpoint
        ? await ctx.db.query("pushSubscriptions").withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint!)).unique()
        : null;

    if (!target || target.userId !== userId) {
      throw new Error("Subscription not found");
    }

    await ctx.db.patch(target._id, {
      isActive: false,
      updatedAtMs: Date.now(),
    });

    return { success: true };
  },
});

export const queueNotification = mutation({
  args: {
    userId: nullableStringArg,
    title: v.string(),
    body: v.string(),
    tag: nullableStringArg,
    data: nullableAnyArg,
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const id = await ctx.db.insert("notificationQueue", {
      userId: args.userId ?? null,
      channel: "push",
      title: args.title,
      body: args.body,
      status: "pending",
      recipientEmail: null,
      tag: args.tag ?? null,
      data: args.data ?? null,
      scheduledForMs: null,
      processingStartedAtMs: null,
      attempts: 0,
      errorMessage: null,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    });

    return { id, success: true, tag: args.tag ?? null, data: args.data ?? null };
  },
});

export const syncSubscriptionFromPayment = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    reference: v.string(),
    tier: v.string(),
    amount: v.number(),
    currency: v.string(),
    status: v.string(),
    expiresAtMs: nullableNumberArg,
    paidAtMs: v.number(),
    metadata: nullableAnyArg,
  },
  handler: async (ctx, args) => {
    const expected = process.env.PAYMENT_SYNC_SECRET;
    if (!expected || args.secret !== expected) {
      throw new Error("Invalid payment sync secret");
    }

    const existingRecord = await ctx.db
      .query("paymentRecords")
      .withIndex("by_reference", (q) => q.eq("reference", args.reference))
      .unique();

    const now = Date.now();
    const payload = {
      userId: args.userId,
      reference: args.reference,
      tier: args.tier,
      amount: args.amount,
      currency: args.currency,
      status: args.status,
      expiresAtMs: args.expiresAtMs ?? null,
      paidAtMs: args.paidAtMs,
      metadata: args.metadata ?? null,
      updatedAtMs: now,
    };

    if (existingRecord) {
      await ctx.db.patch(existingRecord._id, payload);
    } else {
      await ctx.db.insert("paymentRecords", {
        ...payload,
        createdAtMs: now,
      });
    }

    const user = await ctx.db.get(args.userId as any);
    if (user) {
      await ctx.db.patch(args.userId as any, {
        paymentStatus: args.status === "success" ? "paid" : user.paymentStatus ?? "free",
        subscriptionTier: args.tier,
        subscriptionExpiresAtMs: args.expiresAtMs ?? null,
      });
    }

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_external_user_id", (q) => q.eq("externalUserId", args.userId))
      .first();

    if (profile) {
      await ctx.db.patch(profile._id, {
        paymentStatus: args.status === "success" ? "paid" : profile.paymentStatus ?? "free",
        subscriptionTier: args.tier,
        subscriptionExpiresAtMs: args.expiresAtMs ?? null,
        updatedAtMs: now,
      });
    }

    return { success: true };
  },
});

export const restoreLatestPaymentForUser = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const actorId = await getAuthUserId(ctx);
    if (!actorId || actorId !== args.userId) {
      throw new Error("Not authenticated");
    }

    const rows = await ctx.db
      .query("paymentRecords")
      .withIndex("by_user_paid", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(1);

    const payment = rows[0];
    if (!payment || payment.status !== "success") {
      return { success: false, message: "No eligible purchase found." };
    }

    const now = Date.now();
    const user = await ctx.db.get(args.userId as any);
    if (user) {
      await ctx.db.patch(args.userId as any, {
        paymentStatus: "paid",
        subscriptionTier: payment.tier,
        subscriptionExpiresAtMs: payment.expiresAtMs ?? null,
      });
    }

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_external_user_id", (q) => q.eq("externalUserId", args.userId))
      .first();

    if (profile) {
      await ctx.db.patch(profile._id, {
        paymentStatus: "paid",
        subscriptionTier: payment.tier,
        subscriptionExpiresAtMs: payment.expiresAtMs ?? null,
        updatedAtMs: now,
      });
    }

    return {
      success: true,
      message: "Purchase restored",
      data: {
        tier: payment.tier,
        expiry: payment.expiresAtMs ? new Date(payment.expiresAtMs).toISOString() : null,
      },
    };
  },
});
