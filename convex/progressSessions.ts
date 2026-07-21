import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

const nullableStringArg = v.optional(v.union(v.string(), v.null()));

const taskItemValidator = v.object({
  id: v.string(),
  label: v.string(),
  phase: v.union(v.literal("pre_market"), v.literal("session"), v.literal("post_market")),
  completed: v.boolean(),
});

export const getForDay = query({
  args: {
    userId: v.string(),
    dateKey: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("progressSessions")
      .withIndex("by_user_date", (q) => q.eq("userId", args.userId).eq("dateKey", args.dateKey))
      .unique();
  },
});

export const listForUser = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("progressSessions")
      .withIndex("by_user_date", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit ?? 120);
  },
});

export const upsertDay = mutation({
  args: {
    userId: v.string(),
    dateKey: v.string(),
    phase: v.union(v.literal("pre_market"), v.literal("post_market")),
    preMarketNotes: nullableStringArg,
    postMarketNotes: nullableStringArg,
    tasks: v.array(taskItemValidator),
    sessionStarted: v.boolean(),
    journalCreated: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("progressSessions")
      .withIndex("by_user_date", (q) => q.eq("userId", args.userId).eq("dateKey", args.dateKey))
      .unique();

    const now = Date.now();
    const payload = {
      userId: args.userId,
      dateKey: args.dateKey,
      phase: args.phase,
      preMarketNotes: args.preMarketNotes ?? null,
      postMarketNotes: args.postMarketNotes ?? null,
      tasks: args.tasks,
      sessionStarted: args.sessionStarted,
      journalCreated: args.journalCreated,
      updatedAtMs: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return await ctx.db.get(existing._id);
    }

    const insertedId = await ctx.db.insert("progressSessions", {
      ...payload,
      createdAtMs: now,
    });

    return await ctx.db.get(insertedId);
  },
});
