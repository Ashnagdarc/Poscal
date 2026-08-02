import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { internalMutation, mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./lib/auth";

const nullableStringArg = v.optional(v.union(v.string(), v.null()));
const nullableNumberArg = v.optional(v.union(v.number(), v.null()));

/**
 * Profile APIs are auth-bound. Privilege fields (role / subscriptionTier / paymentStatus)
 * are never accepted from the client — only via auth callback or admin/webhook paths.
 */

export const getByUserId = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    return await ctx.db
      .query("profiles")
      .withIndex("by_external_user_id", (q) => q.eq("externalUserId", userId))
      .first();
  },
});

/** Safe self-service profile update — display fields only. */
export const updateViewerSafeFields = mutation({
  args: {
    fullName: nullableStringArg,
    avatarUrl: nullableStringArg,
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_external_user_id", (q) => q.eq("externalUserId", userId))
      .first();

    if (!existing) {
      throw new Error("Profile not found");
    }

    const patch: Record<string, unknown> = {
      updatedAtMs: Date.now(),
    };
    if (args.fullName !== undefined) {
      patch.fullName = args.fullName?.trim() || null;
    }
    if (args.avatarUrl !== undefined) {
      patch.avatarUrl = args.avatarUrl;
    }

    await ctx.db.patch(existing._id, patch);
    return await ctx.db.get(existing._id);
  },
});

/** Trading prefs: timezone, default risk, alert toggles (P-029 / P-030). */
export const updateViewerPreferences = mutation({
  args: {
    timezone: nullableStringArg,
    defaultRiskPercent: nullableNumberArg,
    tradingRiskAlertsEnabled: v.optional(v.boolean()),
    tradingMilestoneAlertsEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    let existing = await ctx.db
      .query("profiles")
      .withIndex("by_external_user_id", (q) => q.eq("externalUserId", userId))
      .first();

    if (!existing && user.email) {
      existing = await ctx.db
        .query("profiles")
        .withIndex("by_email", (q) => q.eq("email", user.email!.trim().toLowerCase()))
        .first();
    }

    const now = Date.now();
    const patch: Record<string, unknown> = {
      externalUserId: userId,
      updatedAtMs: now,
    };

    if (args.timezone !== undefined) {
      const trimmed = args.timezone?.trim() || null;
      if (trimmed) {
        try {
          Intl.DateTimeFormat("en-US", { timeZone: trimmed }).format(now);
        } catch {
          throw new Error("Invalid timezone");
        }
      }
      patch.timezone = trimmed;
    }

    if (args.defaultRiskPercent !== undefined) {
      if (
        args.defaultRiskPercent !== null
        && (!Number.isFinite(args.defaultRiskPercent) || args.defaultRiskPercent <= 0 || args.defaultRiskPercent > 100)
      ) {
        throw new Error("defaultRiskPercent must be between 0 and 100");
      }
      patch.defaultRiskPercent = args.defaultRiskPercent;
    }

    if (args.tradingRiskAlertsEnabled !== undefined) {
      patch.tradingRiskAlertsEnabled = args.tradingRiskAlertsEnabled;
    }
    if (args.tradingMilestoneAlertsEnabled !== undefined) {
      patch.tradingMilestoneAlertsEnabled = args.tradingMilestoneAlertsEnabled;
    }

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return await ctx.db.get(existing._id);
    }

    if (!user.email) {
      throw new Error("Profile not found");
    }

    const id = await ctx.db.insert("profiles", {
      externalUserId: userId,
      email: user.email.trim().toLowerCase(),
      fullName: user.fullName ?? user.name ?? null,
      avatarUrl: user.avatarUrl ?? user.image ?? null,
      role: user.role ?? "user",
      paymentStatus: user.paymentStatus ?? "free",
      subscriptionTier: user.subscriptionTier ?? "free",
      subscriptionExpiresAtMs: user.subscriptionExpiresAtMs ?? null,
      newsAlertsEnabled: true,
      timezone: (patch.timezone as string | null | undefined) ?? null,
      defaultRiskPercent: (patch.defaultRiskPercent as number | null | undefined) ?? null,
      tradingRiskAlertsEnabled:
        (patch.tradingRiskAlertsEnabled as boolean | undefined) ?? true,
      tradingMilestoneAlertsEnabled:
        (patch.tradingMilestoneAlertsEnabled as boolean | undefined) ?? true,
      createdAtMs: now,
      updatedAtMs: now,
    });

    return await ctx.db.get(id);
  },
});

/**
 * @deprecated Removed public privilege-escalation path (AIS-002).
 * Kept as a hard-failing stub so old clients get a clear error instead of silent success.
 */
export const updateByUserId = mutation({
  args: {
    userId: v.optional(v.string()),
    email: nullableStringArg,
    fullName: nullableStringArg,
    avatarUrl: nullableStringArg,
    role: nullableStringArg,
    paymentStatus: nullableStringArg,
    subscriptionTier: nullableStringArg,
    subscriptionExpiresAtMs: v.optional(v.union(v.number(), v.null())),
  },
  handler: async () => {
    throw new Error("profiles:updateByUserId is disabled. Use users.updateViewerProfile.");
  },
});

/** @deprecated Public upsert with privilege fields disabled (AIS-002/003). */
export const upsertFromAuth = mutation({
  args: {
    userId: v.optional(v.string()),
    email: v.optional(v.string()),
    fullName: nullableStringArg,
    avatarUrl: nullableStringArg,
    role: nullableStringArg,
    paymentStatus: nullableStringArg,
    subscriptionTier: nullableStringArg,
    subscriptionExpiresAtMs: v.optional(v.union(v.number(), v.null())),
  },
  handler: async () => {
    throw new Error("profiles:upsertFromAuth is disabled. Profiles sync via auth callbacks.");
  },
});

/** Self-delete only — cannot delete another user's profile. */
export const deleteByUserId = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_external_user_id", (q) => q.eq("externalUserId", userId))
      .first();

    if (!existing) {
      return { success: false };
    }

    await ctx.db.delete(existing._id);
    return { success: true };
  },
});

/** Internal admin/migration helper — not exposed on the public API. */
export const internalDeleteByExternalUserId = internalMutation({
  args: {
    externalUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_external_user_id", (q) => q.eq("externalUserId", args.externalUserId))
      .first();

    if (!existing) {
      return { success: false };
    }

    await ctx.db.delete(existing._id);
    return { success: true };
  },
});
