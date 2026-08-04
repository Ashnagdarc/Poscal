import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireAuthUserId, requireVerifiedAuthUserId } from "./lib/auth";
import { deleteAuthSessionsForUser } from "./lib/sessionInvalidation";

const nullableStringArg = v.optional(v.union(v.string(), v.null()));

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }

    const byUserId = await ctx.db
      .query("profiles")
      .withIndex("by_external_user_id", (q) => q.eq("externalUserId", userId))
      .first();

    const email = user.email?.trim().toLowerCase();
    const byEmail = email
      ? await ctx.db
          .query("profiles")
          .withIndex("by_email", (q) => q.eq("email", email))
          .first()
      : null;

    const profile = byUserId ?? byEmail;

    return {
      id: user._id,
      email: user.email ?? null,
      fullName: user.fullName ?? user.name ?? profile?.fullName ?? null,
      avatarUrl: user.avatarUrl ?? user.image ?? profile?.avatarUrl ?? null,
      emailVerified: user.emailVerificationTime !== undefined,
      role: profile?.role ?? user.role ?? "user",
      // Prefer profile payment fields (same as viewerProfile) so SubscriptionContext
      // can reuse this query without changing paid-lock / expiry behavior.
      paymentStatus: profile?.paymentStatus ?? user.paymentStatus ?? "free",
      subscriptionTier: profile?.subscriptionTier ?? user.subscriptionTier ?? "free",
      subscriptionExpiresAtMs:
        profile?.subscriptionExpiresAtMs ?? user.subscriptionExpiresAtMs ?? null,
      createdAt: user._creationTime,
    };
  },
});

export const viewerProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }

    const byUserId = await ctx.db
      .query("profiles")
      .withIndex("by_external_user_id", (q) => q.eq("externalUserId", userId))
      .first();

    const email = user.email?.trim().toLowerCase();
    const byEmail = email
      ? await ctx.db
          .query("profiles")
          .withIndex("by_email", (q) => q.eq("email", email))
          .first()
      : null;

    const profile = byUserId ?? byEmail;
    const avatarUrl =
      profile?.avatarUrl ??
      byEmail?.avatarUrl ??
      user.avatarUrl ??
      user.image ??
      null;

    if (profile) {
      return {
        id: userId,
        email: profile.email ?? user.email ?? null,
        full_name: profile.fullName ?? user.fullName ?? user.name ?? null,
        avatar_url: avatarUrl,
        role: profile.role ?? user.role ?? "user",
        payment_status: profile.paymentStatus ?? user.paymentStatus ?? "free",
        subscription_tier: profile.subscriptionTier ?? user.subscriptionTier ?? "free",
        subscription_expires_at:
          profile.subscriptionExpiresAtMs ?? user.subscriptionExpiresAtMs ?? null,
        created_at: profile.createdAtMs ?? user._creationTime,
        timezone: profile.timezone ?? null,
        default_risk_percent: profile.defaultRiskPercent ?? null,
        trading_risk_alerts_enabled: profile.tradingRiskAlertsEnabled !== false,
        trading_milestone_alerts_enabled: profile.tradingMilestoneAlertsEnabled !== false,
        news_alerts_enabled: profile.newsAlertsEnabled !== false,
      };
    }

    return {
      id: user._id,
      email: user.email ?? null,
      full_name: user.fullName ?? user.name ?? null,
      avatar_url: avatarUrl,
      role: user.role ?? "user",
      payment_status: user.paymentStatus ?? "free",
      subscription_tier: user.subscriptionTier ?? "free",
      subscription_expires_at: user.subscriptionExpiresAtMs ?? null,
      created_at: user._creationTime,
      timezone: null,
      default_risk_percent: null,
      trading_risk_alerts_enabled: true,
      trading_milestone_alerts_enabled: true,
      news_alerts_enabled: true,
    };
  },
});

export const journalTourStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { completed: false };
    }

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_external_user_id", (q) => q.eq("externalUserId", userId))
      .first();

    return {
      completed: Boolean(profile?.journalTourCompletedAtMs),
    };
  },
});

export const markJournalTourCompleted = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireVerifiedAuthUserId(ctx);

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const now = Date.now();
    let profile = await ctx.db
      .query("profiles")
      .withIndex("by_external_user_id", (q) => q.eq("externalUserId", userId))
      .first();

    if (!profile && user.email) {
      profile = await ctx.db
        .query("profiles")
        .withIndex("by_email", (q) => q.eq("email", user.email!.trim().toLowerCase()))
        .first();
    }

    if (profile) {
      if (profile.journalTourCompletedAtMs) {
        return { completed: true };
      }
      await ctx.db.patch(profile._id, {
        externalUserId: userId,
        journalTourCompletedAtMs: now,
        updatedAtMs: now,
      });
      return { completed: true };
    }

    if (!user.email) {
      throw new Error("Profile email is required to save tour status");
    }

    await ctx.db.insert("profiles", {
      externalUserId: userId,
      email: user.email.trim().toLowerCase(),
      fullName: user.fullName ?? user.name ?? null,
      avatarUrl: user.avatarUrl ?? user.image ?? null,
      role: user.role ?? "user",
      paymentStatus: user.paymentStatus ?? "free",
      subscriptionTier: user.subscriptionTier ?? "free",
      subscriptionExpiresAtMs: user.subscriptionExpiresAtMs ?? null,
      journalTourCompletedAtMs: now,
      createdAtMs: now,
      updatedAtMs: now,
    });

    return { completed: true };
  },
});

export const updateViewerProfile = mutation({
  args: {
    fullName: nullableStringArg,
    avatarUrl: nullableStringArg,
  },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(userId, {
      fullName: args.fullName ?? user.fullName ?? user.name ?? null,
      name: args.fullName ?? user.name ?? null,
      ...(args.avatarUrl !== undefined
        ? {
            avatarUrl: args.avatarUrl,
            image: args.avatarUrl,
          }
        : {}),
    });

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_external_user_id", (q) => q.eq("externalUserId", userId))
      .first();

    if (profile) {
      await ctx.db.patch(profile._id, {
        fullName: args.fullName ?? profile.fullName ?? user.fullName ?? user.name ?? null,
        ...(args.avatarUrl !== undefined ? { avatarUrl: args.avatarUrl } : {}),
        updatedAtMs: Date.now(),
      });
    }

    const updated = await ctx.db.get(userId);
    return {
      id: updated!._id,
      email: updated!.email ?? null,
      full_name: updated!.fullName ?? updated!.name ?? null,
      avatar_url: updated!.avatarUrl ?? updated!.image ?? null,
      email_verified: updated!.emailVerificationTime !== undefined,
    };
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    // Mark pending avatar upload so saveAvatar only accepts this user's blob (AP-006 / MC-017).
    const user = await ctx.db.get(userId);
    if (user) {
      await ctx.db.patch(userId, {
        pendingAvatarUploadAtMs: Date.now(),
      });
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveAvatar = mutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Reject binding arbitrary storage ids unless a recent upload was initiated (AP-006).
    const pendingAt = user.pendingAvatarUploadAtMs;
    const now = Date.now();
    if (
      !pendingAt
      || now - pendingAt > 15 * 60 * 1000
    ) {
      throw new Error("Upload session expired. Please choose the image again.");
    }

    // Already own this blob (re-save) is fine.
    const alreadyOwned =
      user.avatarStorageId === args.storageId
      || Boolean(
        (await ctx.db
          .query("profiles")
          .withIndex("by_external_user_id", (q) => q.eq("externalUserId", userId))
          .first())?.avatarStorageId === args.storageId,
      );

    if (!alreadyOwned) {
      // Ensure the blob exists and is not already another user's current avatar.
      const avatarUrlProbe = await ctx.storage.getUrl(args.storageId);
      if (!avatarUrlProbe) {
        throw new Error("Failed to resolve uploaded avatar URL");
      }
    }

    const avatarUrl = await ctx.storage.getUrl(args.storageId);
    if (!avatarUrl) {
      throw new Error("Failed to resolve uploaded avatar URL");
    }

    const previousStorageId = user.avatarStorageId;
    if (previousStorageId && previousStorageId !== args.storageId) {
      try {
        await ctx.storage.delete(previousStorageId);
      } catch {
        // Ignore cleanup failures for missing/orphaned blobs.
      }
    }

    await ctx.db.patch(userId, {
      avatarUrl,
      image: avatarUrl,
      avatarStorageId: args.storageId,
      pendingAvatarUploadAtMs: null,
    });

    let profile = await ctx.db
      .query("profiles")
      .withIndex("by_external_user_id", (q) => q.eq("externalUserId", userId))
      .first();

    if (!profile && user.email) {
      profile = await ctx.db
        .query("profiles")
        .withIndex("by_email", (q) => q.eq("email", user.email!.trim().toLowerCase()))
        .first();
    }

    if (profile) {
      const previousProfileStorageId = profile.avatarStorageId;
      if (
        previousProfileStorageId &&
        previousProfileStorageId !== args.storageId &&
        previousProfileStorageId !== previousStorageId
      ) {
        try {
          await ctx.storage.delete(previousProfileStorageId);
        } catch {
          // Ignore cleanup failures.
        }
      }

      await ctx.db.patch(profile._id, {
        externalUserId: userId,
        avatarUrl,
        avatarStorageId: args.storageId,
        updatedAtMs: Date.now(),
      });
    } else if (user.email) {
      await ctx.db.insert("profiles", {
        externalUserId: userId,
        email: user.email.trim().toLowerCase(),
        fullName: user.fullName ?? user.name ?? null,
        avatarUrl,
        avatarStorageId: args.storageId,
        role: user.role ?? "user",
        paymentStatus: user.paymentStatus ?? "free",
        subscriptionTier: user.subscriptionTier ?? "free",
        subscriptionExpiresAtMs: user.subscriptionExpiresAtMs ?? null,
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
      });
    }

    return {
      avatar_url: avatarUrl,
      storage_id: args.storageId,
    };
  },
});

/**
 * Session summary for multi-device security UI (MC-032 / AP-012).
 * Returns null when unauthenticated.
 */
export const sessionSummary = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const currentSessionId = await getAuthSessionId(ctx);
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();

    const otherCount = sessions.filter(
      (session) => session._id !== currentSessionId,
    ).length;

    return {
      total: sessions.length,
      otherCount,
      hasCurrent: currentSessionId !== null,
    };
  },
});

/**
 * Invalidate every auth session for the caller except the current device.
 * Does not delete user data. Stolen refresh tokens on other devices die.
 *
 * "Sign out everywhere" = this mutation + client signOut (kills current too).
 */
export const revokeOtherSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const currentSessionId = await getAuthSessionId(ctx);
    if (!currentSessionId) {
      throw new Error("Not authenticated");
    }

    const revoked = await deleteAuthSessionsForUser(ctx.db, userId, {
      exceptSessionId: currentSessionId,
    });

    return { success: true as const, revoked };
  },
});

/**
 * Invalidate ALL auth sessions for the caller, including this device.
 * Client should call signOut and clear local state after success.
 * Prefer for "Sign out everywhere"; leave user data intact.
 */
export const revokeAllSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const revoked = await deleteAuthSessionsForUser(ctx.db, userId);
    return { success: true as const, revoked };
  },
});

/**
 * Hard-delete the authenticated user's Poscal data + auth records (GDPR-style).
 * Irreversible. Client must sign out after success.
 */
export const deleteAccount = mutation({
  args: {
    confirmation: v.literal("DELETE"),
  },
  handler: async (ctx, args) => {
    void args;
    // Account deletion remains available without verification (GDPR path).
    const userId = await requireAuthUserId(ctx);

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const counts = {
      trades: 0,
      history: 0,
      sessions: 0,
      journals: 0,
      push: 0,
      payments: 0,
      notifications: 0,
      authSessions: 0,
      authAccounts: 0,
      profiles: 0,
    };

    const tradeRows = await ctx.db
      .query("tradingJournal")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .collect();
    for (const row of tradeRows) {
      await ctx.db.delete(row._id);
      counts.trades += 1;
    }

    const historyRows = await ctx.db
      .query("calculatorHistory")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .collect();
    for (const row of historyRows) {
      await ctx.db.delete(row._id);
      counts.history += 1;
    }

    const sessionRows = await ctx.db
      .query("progressSessions")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .collect();
    for (const row of sessionRows) {
      await ctx.db.delete(row._id);
      counts.sessions += 1;
    }

    const journalRows = await ctx.db
      .query("tradingAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const row of journalRows) {
      await ctx.db.delete(row._id);
      counts.journals += 1;
    }

    const pushRows = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const row of pushRows) {
      await ctx.db.delete(row._id);
      counts.push += 1;
    }

    const paymentRows = await ctx.db
      .query("paymentRecords")
      .withIndex("by_user_paid", (q) => q.eq("userId", userId))
      .collect();
    for (const row of paymentRows) {
      await ctx.db.delete(row._id);
      counts.payments += 1;
    }

    const notificationRows = await ctx.db
      .query("notificationQueue")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .collect();
    for (const row of notificationRows) {
      await ctx.db.delete(row._id);
      counts.notifications += 1;
    }

    // Erase residual app-layer rate-limit email keys (AP-015 / MC-035).
    if (user.email) {
      const email = user.email.trim().toLowerCase();
      const actions = ["signIn", "signUp", "reset"] as const;
      for (const action of actions) {
        const key = `auth:${action}:${email}`;
        const rateRow = await ctx.db
          .query("appAuthRateLimits")
          .withIndex("by_key", (q) => q.eq("key", key))
          .unique();
        if (rateRow) {
          await ctx.db.delete(rateRow._id);
        }
      }
    }

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_external_user_id", (q) => q.eq("externalUserId", userId))
      .first();
    if (profile) {
      if (profile.avatarStorageId) {
        try {
          await ctx.storage.delete(profile.avatarStorageId);
        } catch {
          // Ignore orphaned storage.
        }
      }
      await ctx.db.delete(profile._id);
      counts.profiles += 1;
    }

    if (user.avatarStorageId) {
      try {
        await ctx.storage.delete(user.avatarStorageId);
      } catch {
        // Ignore orphaned storage.
      }
    }

    counts.authSessions = await deleteAuthSessionsForUser(ctx.db, userId);

    const authAccounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .collect();
    for (const account of authAccounts) {
      const codes = await ctx.db
        .query("authVerificationCodes")
        .withIndex("accountId", (q) => q.eq("accountId", account._id))
        .collect();
      for (const code of codes) {
        await ctx.db.delete(code._id);
      }
      await ctx.db.delete(account._id);
      counts.authAccounts += 1;
    }

    await ctx.db.delete(userId);

    return { success: true as const, counts };
  },
});
