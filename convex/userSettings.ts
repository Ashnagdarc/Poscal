import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

const nullableString = v.optional(v.union(v.string(), v.null()));
const nullableNumber = v.optional(v.union(v.number(), v.null()));

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    return await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const upsertViewer = mutation({
  args: {
    defaultRiskPercent: nullableNumber,
    accountCurrency: nullableString,
    theme: nullableString,
    hapticsEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const payload = {
      userId,
      defaultRiskPercent: args.defaultRiskPercent ?? null,
      accountCurrency: args.accountCurrency ?? null,
      theme: args.theme ?? null,
      hapticsEnabled: args.hapticsEnabled,
      updatedAtMs: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("userSettings", payload);
  },
});
