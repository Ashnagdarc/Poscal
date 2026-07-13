import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

const nullableString = v.optional(v.union(v.string(), v.null()));

export const listForViewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    return await ctx.db
      .query("brokerProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const createForViewer = mutation({
  args: {
    name: v.string(),
    brokerId: v.string(),
    accountCurrency: nullableString,
    notes: nullableString,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db.insert("brokerProfiles", {
      userId,
      name: args.name.trim(),
      brokerId: args.brokerId,
      accountCurrency: args.accountCurrency ?? null,
      notes: args.notes ?? null,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    });
  },
});

export const removeForViewer = mutation({
  args: {
    id: v.id("brokerProfiles"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const row = await ctx.db.get(args.id);
    if (!row || row.userId !== userId) {
      throw new Error("Broker profile not found");
    }

    await ctx.db.delete(args.id);
    return { deleted: true };
  },
});
