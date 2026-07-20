import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

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

    const email = user.email?.trim().toLowerCase();
    const byEmail = email
      ? await ctx.db
          .query("profiles")
          .withIndex("by_email", (q) => q.eq("email", email))
          .first()
      : null;

    return {
      id: user._id,
      email: user.email ?? null,
      fullName: user.fullName ?? user.name ?? byEmail?.fullName ?? null,
      avatarUrl: user.avatarUrl ?? user.image ?? byEmail?.avatarUrl ?? null,
      emailVerified: user.emailVerificationTime !== undefined,
      role: user.role ?? byEmail?.role ?? "user",
      paymentStatus: user.paymentStatus ?? byEmail?.paymentStatus ?? "free",
      subscriptionTier: user.subscriptionTier ?? byEmail?.subscriptionTier ?? "free",
      subscriptionExpiresAtMs:
        user.subscriptionExpiresAtMs ?? byEmail?.subscriptionExpiresAtMs ?? null,
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
    };
  },
});

export const updateViewerProfile = mutation({
  args: {
    fullName: nullableStringArg,
    avatarUrl: nullableStringArg,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

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
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveAvatar = mutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
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
