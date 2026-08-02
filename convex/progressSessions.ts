import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

const nullableStringArg = v.optional(v.union(v.string(), v.null()));

const taskItemValidator = v.object({
  id: v.string(),
  label: v.string(),
  phase: v.union(v.literal("pre_market"), v.literal("session"), v.literal("post_market")),
  completed: v.boolean(),
});

const journalIdArg = v.optional(v.union(v.id("tradingAccounts"), v.null()));

export const getForDay = query({
  args: {
    userId: v.string(),
    dateKey: v.string(),
    journalId: journalIdArg,
  },
  handler: async (ctx, args) => {
    if (args.journalId) {
      const scoped = await ctx.db
        .query("progressSessions")
        .withIndex("by_user_journal_date", (q) =>
          q.eq("userId", args.userId).eq("journalId", args.journalId).eq("dateKey", args.dateKey),
        )
        .unique();
      if (scoped) return scoped;
    }

    const legacy = await ctx.db
      .query("progressSessions")
      .withIndex("by_user_date", (q) => q.eq("userId", args.userId).eq("dateKey", args.dateKey))
      .collect();

    if (args.journalId) {
      return legacy.find((row) => !row.journalId || row.journalId === args.journalId) ?? null;
    }

    return legacy[0] ?? null;
  },
});

export const listForUser = query({
  args: {
    userId: v.string(),
    journalId: journalIdArg,
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("progressSessions")
      .withIndex("by_user_date", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit ?? 120);

    if (!args.journalId) {
      return rows;
    }

    return rows.filter((row) => !row.journalId || row.journalId === args.journalId);
  },
});

export const upsertDay = mutation({
  args: {
    userId: v.string(),
    journalId: journalIdArg,
    dateKey: v.string(),
    phase: v.union(v.literal("pre_market"), v.literal("post_market")),
    preMarketNotes: nullableStringArg,
    postMarketNotes: nullableStringArg,
    tasks: v.array(taskItemValidator),
    sessionStarted: v.boolean(),
    journalCreated: v.boolean(),
  },
  handler: async (ctx, args) => {
    let existing =
      args.journalId
        ? await ctx.db
            .query("progressSessions")
            .withIndex("by_user_journal_date", (q) =>
              q.eq("userId", args.userId).eq("journalId", args.journalId).eq("dateKey", args.dateKey),
            )
            .unique()
        : null;

    if (!existing) {
      const legacy = await ctx.db
        .query("progressSessions")
        .withIndex("by_user_date", (q) => q.eq("userId", args.userId).eq("dateKey", args.dateKey))
        .collect();
      existing =
        (args.journalId
          ? legacy.find((row) => !row.journalId || row.journalId === args.journalId)
          : legacy[0]) ?? null;
    }

    const now = Date.now();
    const payload = {
      userId: args.userId,
      journalId: args.journalId ?? existing?.journalId ?? null,
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
