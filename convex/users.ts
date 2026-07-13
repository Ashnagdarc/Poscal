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

    return {
      id: user._id,
      email: user.email ?? null,
      fullName: user.fullName ?? user.name ?? null,
      avatarUrl: user.avatarUrl ?? user.image ?? null,
      emailVerified: user.emailVerificationTime !== undefined,
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

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_external_user_id", (q) => q.eq("externalUserId", userId))
      .first();

    if (profile) {
      return {
        id: profile.externalUserId,
        email: profile.email,
        full_name: profile.fullName ?? null,
        avatar_url: profile.avatarUrl ?? null,
        created_at: profile.createdAtMs,
      };
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }

    return {
      id: user._id,
      email: user.email ?? null,
      full_name: user.fullName ?? user.name ?? null,
      avatar_url: user.avatarUrl ?? user.image ?? null,
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
      avatarUrl: args.avatarUrl ?? user.avatarUrl ?? user.image ?? null,
      image: args.avatarUrl ?? user.image ?? null,
    });

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_external_user_id", (q) => q.eq("externalUserId", userId))
      .first();

    if (profile) {
      await ctx.db.patch(profile._id, {
        fullName: args.fullName ?? profile.fullName ?? user.fullName ?? user.name ?? null,
        avatarUrl: args.avatarUrl ?? profile.avatarUrl ?? user.avatarUrl ?? user.image ?? null,
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
