import { anyApi } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { getVerifiedAuthUserId, requireVerifiedAuthUserId } from "./lib/auth";
import { isOptionalBackgroundWorkPaused } from "./lib/backgroundWork";

const BATCH_SIZE = 200;
const BACKFILL_ACTIVE_WINDOW_MS = 5 * 60 * 1000;

import { emptyAccumulator, fromBackfill, accumulateTrade, publicStatsPayload } from "./lib/journalStats";

const assertOwnedJournal = async (
  ctx: { db: any },
  userId: string,
  journalId: Id<"tradingAccounts">,
) => {
  const journal = await ctx.db.get(journalId);
  if (!journal || journal.userId !== userId) {
    throw new Error("Journal not found");
  }
  return journal;
};

export const getForJournal = query({
  args: { journalId: v.id("tradingAccounts") },
  handler: async (ctx, args) => {
    const userId = await getVerifiedAuthUserId(ctx);
    if (!userId) return null;

    const journal = await assertOwnedJournal(ctx, userId, args.journalId);
    const sourceVersion = journal.statsVersion ?? 0;
    const stats = await ctx.db
      .query("journalTradeStats")
      .withIndex("by_user_journal", (q) =>
        q.eq("userId", userId).eq("journalId", args.journalId),
      )
      .unique();

    if (!stats) {
      return { stats: null, stale: true, sourceVersion };
    }

    return {
      stats,
      stale: stats.sourceVersion !== sourceVersion || stats.orderedMetricsStale === true || !stats.appendState,
      sourceVersion,
    };
  },
});

export const ensureForJournal = mutation({
  args: { journalId: v.id("tradingAccounts") },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    const journal = await assertOwnedJournal(ctx, userId, args.journalId);
    if (isOptionalBackgroundWorkPaused()) {
      return { status: "paused" as const };
    }

    const sourceVersion = journal.statsVersion ?? 0;
    const existingStats = await ctx.db
      .query("journalTradeStats")
      .withIndex("by_user_journal", (q) =>
        q.eq("userId", userId).eq("journalId", args.journalId),
      )
      .unique();

    if (existingStats && existingStats.sourceVersion === sourceVersion && !existingStats.orderedMetricsStale && existingStats.appendState) {
      return { status: "ready" as const };
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("journalTradeStatsBackfills")
      .withIndex("by_user_journal", (q) =>
        q.eq("userId", userId).eq("journalId", args.journalId),
      )
      .unique();

    if (
      existing
      && existing.status === "running"
      && existing.sourceVersion === sourceVersion
      && now - existing.updatedAtMs < BACKFILL_ACTIVE_WINDOW_MS
    ) {
      // Multiple tabs/devices can notice the same stale stats at once.
      // Treat recently-updated work as single-flight, but allow an abandoned
      // backfill to be restarted after the activity window.
      return { status: "already_running" as const };
    }

    const initial = emptyAccumulator();
    let backfillId: Id<"journalTradeStatsBackfills">;

    if (existing) {
      await ctx.db.patch(existing._id, {
        sourceVersion,
        status: "running",
        cursor: null,
        ...initial,
        startedAtMs: now,
        updatedAtMs: now,
      });
      backfillId = existing._id;
    } else {
      backfillId = await ctx.db.insert("journalTradeStatsBackfills", {
        userId,
        journalId: args.journalId,
        sourceVersion,
        status: "running",
        cursor: null,
        ...initial,
        startedAtMs: now,
        updatedAtMs: now,
      });
    }

    await ctx.scheduler.runAfter(0, anyApi.journalTradeStats.processBackfill, {
      backfillId,
    });
    return { status: "started" as const };
  },
});

export const processBackfill = internalMutation({
  args: { backfillId: v.id("journalTradeStatsBackfills") },
  handler: async (ctx, args) => {
    if (isOptionalBackgroundWorkPaused()) return;

    const backfill = await ctx.db.get(args.backfillId);
    if (!backfill || backfill.status !== "running") return;

    const journal = await ctx.db.get(backfill.journalId);
    if (!journal || journal.userId !== backfill.userId) {
      await ctx.db.patch(backfill._id, {
        status: "failed",
        updatedAtMs: Date.now(),
      });
      return;
    }

    const currentVersion = journal.statsVersion ?? 0;
    if (currentVersion !== backfill.sourceVersion) {
      const reset = emptyAccumulator();
      await ctx.db.patch(backfill._id, {
        sourceVersion: currentVersion,
        cursor: null,
        ...reset,
        startedAtMs: Date.now(),
        updatedAtMs: Date.now(),
      });
      await ctx.scheduler.runAfter(0, anyApi.journalTradeStats.processBackfill, {
        backfillId: backfill._id,
      });
      return;
    }

    const page = await ctx.db
      .query("tradingJournal")
      .withIndex("by_user_journal_created", (q) =>
        q.eq("userId", backfill.userId).eq("journalId", backfill.journalId),
      )
      .order("asc")
      .paginate({
        numItems: BATCH_SIZE,
        cursor: backfill.cursor ?? null,
      });

    const acc = fromBackfill(backfill);
    for (const trade of page.page) {
      accumulateTrade(acc, trade);
    }

    if (!page.isDone) {
      await ctx.db.patch(backfill._id, {
        cursor: page.continueCursor,
        ...acc,
        updatedAtMs: Date.now(),
      });
      await ctx.scheduler.runAfter(0, anyApi.journalTradeStats.processBackfill, {
        backfillId: backfill._id,
      });
      return;
    }

    // The journal read participates in this mutation's OCC snapshot. If a trade
    // write bumps statsVersion concurrently, Convex retries and this check sees it.
    const finalJournal = await ctx.db.get(backfill.journalId);
    const finalVersion = finalJournal?.statsVersion ?? 0;
    if (!finalJournal || finalJournal.userId !== backfill.userId) {
      await ctx.db.patch(backfill._id, {
        status: "failed",
        updatedAtMs: Date.now(),
      });
      return;
    }
    if (finalVersion !== backfill.sourceVersion) {
      const reset = emptyAccumulator();
      await ctx.db.patch(backfill._id, {
        sourceVersion: finalVersion,
        cursor: null,
        ...reset,
        startedAtMs: Date.now(),
        updatedAtMs: Date.now(),
      });
      await ctx.scheduler.runAfter(0, anyApi.journalTradeStats.processBackfill, {
        backfillId: backfill._id,
      });
      return;
    }

    const now = Date.now();
    const existingStats = await ctx.db
      .query("journalTradeStats")
      .withIndex("by_user_journal", (q) =>
        q.eq("userId", backfill.userId).eq("journalId", backfill.journalId),
      )
      .unique();

    const payload = {
      userId: backfill.userId,
      journalId: backfill.journalId,
      sourceVersion: backfill.sourceVersion,
      ...publicStatsPayload(acc),
      orderedMetricsStale: false,
      appendState: {
        currentWinStreak: acc.currentWinStreak,
        currentLossStreak: acc.currentLossStreak,
        runningPnl: acc.runningPnl,
        peakPnl: acc.peakPnl,
      },
      updatedAtMs: now,
    };

    if (existingStats) {
      await ctx.db.patch(existingStats._id, payload);
    } else {
      await ctx.db.insert("journalTradeStats", payload);
    }

    await ctx.db.patch(backfill._id, {
      cursor: page.continueCursor,
      ...acc,
      status: "complete",
      updatedAtMs: now,
    });
  },
});
