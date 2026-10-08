import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import {
  getVerifiedAuthUserId,
  requireVerifiedAuthUserId,
} from "./lib/auth";

const nullableStringArg = v.optional(v.union(v.string(), v.null()));
const nullableNumberArg = v.optional(v.union(v.number(), v.null()));
const nullableAnyArg = v.optional(v.union(v.any(), v.null()));
const APP_FONT_KEY = "app_font";
const INGESTOR_HEALTH_KEY = "primary";
const APP_FONT_IDS = ["classic", "markets"] as const;

const resolveAppFontId = (value?: string | null) => {
  if (value && (APP_FONT_IDS as readonly string[]).includes(value)) {
    return value;
  }
  return "markets";
};

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
    await requireAdmin(ctx);
    return { success: true };
  },
});

export const getAppFont = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", APP_FONT_KEY))
      .unique();

    return resolveAppFontId(row?.valueString);
  },
});

export const setAppFont = mutation({
  args: {
    fontId: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const fontId = resolveAppFontId(args.fontId);

    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", APP_FONT_KEY))
      .unique();

    const payload = {
      key: APP_FONT_KEY,
      valueBoolean: null,
      valueString: fontId,
      valueNumber: null,
      updatedAtMs: Date.now(),
      updatedByUserId: userId,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("appSettings", payload);
    }

    return fontId;
  },
});

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("profiles").collect();

    const accounts = await ctx.db.query("proAccounts").take(5000);
    const byUser = new Map(accounts.map(account => [String(account.userId), account]));
    return rows
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
      .map((row) => ({
        id: row.externalUserId,
        full_name: row.fullName ?? null,
        email: row.email,
        is_admin: isElevatedRole(row.role ?? "user"),
        account_type: row.role ?? "user",
        created_at: new Date(row.createdAtMs).toISOString(),
        subscription_tier: (byUser.get(row.externalUserId)?.expiresAtMs ?? 0) > Date.now() ? "pro" : "free",
        subscription_end: byUser.get(row.externalUserId)?.expiresAtMs ? new Date(byUser.get(row.externalUserId)!.expiresAtMs).toISOString() : null,
      }));
  },
});

export const setUserRole = mutation({
  args: {
    userId: v.string(),
    isAdmin: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { userId: actorId, role: actorRole } = await requireAdmin(ctx);

    if (args.userId === actorId) {
      throw new Error("You cannot change your own admin role");
    }

    const targetUser = await ctx.db.get(args.userId as Id<"users">);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_external_user_id", (q) => q.eq("externalUserId", args.userId))
      .first();

    if (!profile && !targetUser) {
      throw new Error("User not found");
    }

    const currentRole = profile?.role ?? targetUser?.role ?? "user";
    if (currentRole === "super_admin" && actorRole !== "super_admin") {
      throw new Error("Only super admins can modify super admin accounts");
    }

    const newRole = args.isAdmin ? "admin" : "user";
    const now = Date.now();

    if (profile) {
      await ctx.db.patch(profile._id, {
        role: newRole,
        updatedAtMs: now,
      });
    }

    if (targetUser) {
      await ctx.db.patch(args.userId as any, { role: newRole });
    }

    return {
      id: args.userId,
      is_admin: isElevatedRole(newRole),
      role: newRole,
    };
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

/** AIS-004: Ingestor health writes are internal-only (or secret-gated HTTP). */
export const upsertIngestorHealth = internalMutation({
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
    const userId = await requireVerifiedAuthUserId(ctx);
    const now = Date.now();

    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .unique();

    if (existing) {
      const sameCredentials =
        existing.p256dhKey === args.p256dhKey &&
        existing.authKey === args.authKey;

      // A Web Push endpoint belongs to the browser/service-worker subscription.
      // Rebinding the same endpoint to the currently authenticated account is safe
      // only when the browser proves possession of the same subscription keys.
      if (existing.userId && existing.userId !== userId && !sameCredentials) {
        throw new Error("Push subscription credentials do not match this device");
      }

      const status =
        existing.userId !== userId
          ? "rebound"
          : existing.isActive && sameCredentials
            ? "already_registered"
            : "refreshed";

      await ctx.db.patch(existing._id, {
        userId,
        endpoint: args.endpoint,
        p256dhKey: args.p256dhKey,
        authKey: args.authKey,
        isActive: true,
        updatedAtMs: now,
        lastVerifiedAtMs: now,
      });

      return { id: existing._id, status };
    }

    const id = await ctx.db.insert("pushSubscriptions", {
      userId,
      endpoint: args.endpoint,
      p256dhKey: args.p256dhKey,
      authKey: args.authKey,
      isActive: true,
      createdAtMs: now,
      updatedAtMs: now,
      lastVerifiedAtMs: now,
    });

    return { id, status: "created" as const };
  },
});

export const listPushSubscriptions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getVerifiedAuthUserId(ctx);
    if (!userId) return [];

    const rows = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Never return p256dh / auth keys to the client (AP-005 / MC-016).
    return rows
      .filter((row) => row.isActive)
      .map((row) => ({
        id: row._id,
        endpoint: row.endpoint,
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
    const userId = await requireVerifiedAuthUserId(ctx);

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
    const actorId = await getAuthUserId(ctx);
    if (!actorId) {
      throw new Error("Not authenticated");
    }

    const actor = await ctx.db.get(actorId);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_external_user_id", (q: any) => q.eq("externalUserId", actorId))
      .first();
    const role = profile?.role ?? actor?.role ?? "user";

    if (!isElevatedRole(role)) {
      throw new Error("Admin access required");
    }

    const tag = args.tag ?? "general";
    await ctx.scheduler.runAfter(0, internal.notifications.enqueueDevicePushes, {
      userId: args.userId ?? null,
      title: args.title,
      body: args.body,
      tag,
      deliveryKey: `${Date.now()}`,
      data: args.data ?? null,
      cursor: null,
    });

    return { success: true, tag, data: args.data ?? null };
  },
});
