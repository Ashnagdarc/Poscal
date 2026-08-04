import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { getVerifiedAuthUserId, requireVerifiedAuthUserId } from "./lib/auth";

const nullableStringArg = v.optional(v.union(v.string(), v.null()));

const taskItemValidator = v.object({
  id: v.string(),
  label: v.string(),
  phase: v.union(v.literal("pre_market"), v.literal("session"), v.literal("post_market")),
  completed: v.boolean(),
});

const journalIdArg = v.optional(v.union(v.id("tradingAccounts"), v.null()));

const assertJournalOwned = async (
  ctx: { db: any },
  userId: string,
  journalId: string | null | undefined,
) => {
  if (!journalId) return;
  const journal = await ctx.db.get(journalId);
  if (!journal || journal.userId !== userId) {
    throw new Error("Journal not found");
  }
};

export const getForDay = query({
  args: {
    dateKey: v.string(),
    journalId: journalIdArg,
  },
  handler: async (ctx, args) => {
    const userId = await getVerifiedAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    if (args.journalId) {
      await assertJournalOwned(ctx, userId, args.journalId);
      const scoped = await ctx.db
        .query("progressSessions")
        .withIndex("by_user_journal_date", (q) =>
          q.eq("userId", userId).eq("journalId", args.journalId).eq("dateKey", args.dateKey),
        )
        .unique();
      if (scoped) return scoped;
    }

    const legacy = await ctx.db
      .query("progressSessions")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("dateKey", args.dateKey))
      .collect();

    if (args.journalId) {
      return legacy.find((row) => !row.journalId || row.journalId === args.journalId) ?? null;
    }

    return legacy[0] ?? null;
  },
});

export const listForUser = query({
  args: {
    journalId: journalIdArg,
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getVerifiedAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    if (args.journalId) {
      await assertJournalOwned(ctx, userId, args.journalId);
      return await ctx.db
        .query("progressSessions")
        .withIndex("by_user_journal_date", (q) =>
          q.eq("userId", userId).eq("journalId", args.journalId),
        )
        .order("desc")
        .take(args.limit ?? 120);
    }

    return await ctx.db
      .query("progressSessions")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .order("desc")
      .take(args.limit ?? 120);
  },
});

export const upsertDay = mutation({
  args: {
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
    const userId = await requireVerifiedAuthUserId(ctx);
    await assertJournalOwned(ctx, userId, args.journalId);

    const noteCap = 8_000;
    if (args.preMarketNotes && args.preMarketNotes.length > noteCap) {
      throw new Error("Pre-market notes are too long");
    }
    if (args.postMarketNotes && args.postMarketNotes.length > noteCap) {
      throw new Error("Post-market notes are too long");
    }
    if (args.tasks.length > 100) {
      throw new Error("Too many checklist tasks");
    }

    let existing =
      args.journalId
        ? await ctx.db
            .query("progressSessions")
            .withIndex("by_user_journal_date", (q) =>
              q.eq("userId", userId).eq("journalId", args.journalId).eq("dateKey", args.dateKey),
            )
            .unique()
        : null;

    if (!existing) {
      const legacy = await ctx.db
        .query("progressSessions")
        .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("dateKey", args.dateKey))
        .collect();
      existing =
        (args.journalId
          ? legacy.find((row) => !row.journalId || row.journalId === args.journalId)
          : legacy[0]) ?? null;
    }

    const now = Date.now();
    const payload = {
      userId,
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
      if (existing.userId !== userId) {
        throw new Error("Not authorized");
      }
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
