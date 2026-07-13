import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

const nullableStringArg = v.optional(v.union(v.string(), v.null()));
const nullableNumberArg = v.optional(v.union(v.number(), v.null()));

export const getByUserId = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("profiles")
      .withIndex("by_external_user_id", (q) => q.eq("externalUserId", args.userId))
      .first();
  },
});

export const upsertFromAuth = mutation({
  args: {
    userId: v.string(),
    email: v.string(),
    fullName: nullableStringArg,
    avatarUrl: nullableStringArg,
    role: nullableStringArg,
    paymentStatus: nullableStringArg,
    subscriptionTier: nullableStringArg,
    subscriptionExpiresAtMs: nullableNumberArg,
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing =
      await ctx.db
        .query("profiles")
        .withIndex("by_external_user_id", (q) => q.eq("externalUserId", args.userId))
        .first() ??
      await ctx.db
        .query("profiles")
        .withIndex("by_email", (q) => q.eq("email", args.email))
        .first();

    const payload = {
      externalUserId: args.userId,
      email: args.email,
      fullName: args.fullName ?? null,
      avatarUrl: args.avatarUrl ?? null,
      role: args.role ?? undefined,
      paymentStatus: args.paymentStatus ?? undefined,
      subscriptionTier: args.subscriptionTier ?? undefined,
      subscriptionExpiresAtMs: args.subscriptionExpiresAtMs ?? null,
      updatedAtMs: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return await ctx.db.get(existing._id);
    }

    const insertedId = await ctx.db.insert("profiles", {
      ...payload,
      createdAtMs: now,
    });

    return await ctx.db.get(insertedId);
  },
});

export const updateByUserId = mutation({
  args: {
    userId: v.string(),
    email: nullableStringArg,
    fullName: nullableStringArg,
    avatarUrl: nullableStringArg,
    role: nullableStringArg,
    paymentStatus: nullableStringArg,
    subscriptionTier: nullableStringArg,
    subscriptionExpiresAtMs: nullableNumberArg,
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_external_user_id", (q) => q.eq("externalUserId", args.userId))
      .first();

    if (!existing) {
      const insertedId = await ctx.db.insert("profiles", {
        externalUserId: args.userId,
        email: args.email ?? "",
        fullName: args.fullName ?? null,
        avatarUrl: args.avatarUrl ?? null,
        role: args.role ?? undefined,
        paymentStatus: args.paymentStatus ?? undefined,
        subscriptionTier: args.subscriptionTier ?? undefined,
        subscriptionExpiresAtMs: args.subscriptionExpiresAtMs ?? null,
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
      });
      return await ctx.db.get(insertedId);
    }

    await ctx.db.patch(existing._id, {
      email: args.email ?? existing.email,
      fullName: args.fullName ?? existing.fullName ?? null,
      avatarUrl: args.avatarUrl ?? existing.avatarUrl ?? null,
      role: args.role ?? existing.role,
      paymentStatus: args.paymentStatus ?? existing.paymentStatus,
      subscriptionTier: args.subscriptionTier ?? existing.subscriptionTier,
      subscriptionExpiresAtMs: args.subscriptionExpiresAtMs ?? existing.subscriptionExpiresAtMs ?? null,
      updatedAtMs: Date.now(),
    });

    return await ctx.db.get(existing._id);
  },
});

export const deleteByUserId = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_external_user_id", (q) => q.eq("externalUserId", args.userId))
      .first();

    if (!existing) {
      return { success: false };
    }

    await ctx.db.delete(existing._id);
    return { success: true };
  },
});
