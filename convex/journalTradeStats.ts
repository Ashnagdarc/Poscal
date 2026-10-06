import { anyApi } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { getVerifiedAuthUserId, requireVerifiedAuthUserId } from "./lib/auth";

const BATCH_SIZE = 200;

type Accumulator = {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  cancelledTrades: number;
  closedWithPnl: number;
  wins: number;
  losses: number;
  breakeven: number;
  totalPnl: number;
  grossProfit: number;
  grossLoss: number;
  winPnlSum: number;
  lossAbsSum: number;
  bestTrade: number | null;
  worstTrade: number | null;
  rCount: number;
  rSum: number;
  currentWinStreak: number;
  currentLossStreak: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  runningPnl: number;
  peakPnl: number;
  maxDrawdown: number;
  processedTrades: number;
};

const emptyAccumulator = (): Accumulator => ({
  totalTrades: 0,
  openTrades: 0,
  closedTrades: 0,
  cancelledTrades: 0,
  closedWithPnl: 0,
  wins: 0,
  losses: 0,
  breakeven: 0,
  totalPnl: 0,
  grossProfit: 0,
  grossLoss: 0,
  winPnlSum: 0,
  lossAbsSum: 0,
  bestTrade: null,
  worstTrade: null,
  rCount: 0,
  rSum: 0,
  currentWinStreak: 0,
  currentLossStreak: 0,
  maxConsecutiveWins: 0,
  maxConsecutiveLosses: 0,
  runningPnl: 0,
  peakPnl: 0,
  maxDrawdown: 0,
  processedTrades: 0,
});

const fromBackfill = (row: Doc<"journalTradeStatsBackfills">): Accumulator => ({
  totalTrades: row.totalTrades,
  openTrades: row.openTrades,
  closedTrades: row.closedTrades,
  cancelledTrades: row.cancelledTrades,
  closedWithPnl: row.closedWithPnl,
  wins: row.wins,
  losses: row.losses,
  breakeven: row.breakeven,
  totalPnl: row.totalPnl,
  grossProfit: row.grossProfit,
  grossLoss: row.grossLoss,
  winPnlSum: row.winPnlSum,
  lossAbsSum: row.lossAbsSum,
  bestTrade: row.bestTrade ?? null,
  worstTrade: row.worstTrade ?? null,
  rCount: row.rCount,
  rSum: row.rSum,
  currentWinStreak: row.currentWinStreak,
  currentLossStreak: row.currentLossStreak,
  maxConsecutiveWins: row.maxConsecutiveWins,
  maxConsecutiveLosses: row.maxConsecutiveLosses,
  runningPnl: row.runningPnl,
  peakPnl: row.peakPnl,
  maxDrawdown: row.maxDrawdown,
  processedTrades: row.processedTrades,
});

const accumulateTrade = (acc: Accumulator, trade: Doc<"tradingJournal">) => {
  acc.totalTrades += 1;
  acc.processedTrades += 1;

  if (trade.status === "open") acc.openTrades += 1;
  else if (trade.status === "closed") acc.closedTrades += 1;
  else if (trade.status === "cancelled") acc.cancelledTrades += 1;

  if (
    trade.status !== "closed"
    || trade.pnl === null
    || trade.pnl === undefined
    || !Number.isFinite(trade.pnl)
  ) {
    return;
  }

  const pnl = trade.pnl;
  acc.closedWithPnl += 1;
  acc.totalPnl += pnl;
  acc.runningPnl += pnl;
  acc.peakPnl = Math.max(acc.peakPnl, acc.runningPnl);
  acc.maxDrawdown = Math.min(acc.maxDrawdown, acc.runningPnl - acc.peakPnl);
  acc.bestTrade = acc.bestTrade === null ? pnl : Math.max(acc.bestTrade, pnl);
  acc.worstTrade = acc.worstTrade === null ? pnl : Math.min(acc.worstTrade, pnl);

  if (pnl > 0) {
    acc.wins += 1;
    acc.grossProfit += pnl;
    acc.winPnlSum += pnl;
    acc.currentWinStreak += 1;
    acc.currentLossStreak = 0;
    acc.maxConsecutiveWins = Math.max(acc.maxConsecutiveWins, acc.currentWinStreak);
  } else if (pnl < 0) {
    const abs = Math.abs(pnl);
    acc.losses += 1;
    acc.grossLoss += abs;
    acc.lossAbsSum += abs;
    acc.currentLossStreak += 1;
    acc.currentWinStreak = 0;
    acc.maxConsecutiveLosses = Math.max(acc.maxConsecutiveLosses, acc.currentLossStreak);
  } else {
    acc.breakeven += 1;
    acc.currentWinStreak = 0;
    acc.currentLossStreak = 0;
  }

  if (
    trade.riskAmount !== null
    && trade.riskAmount !== undefined
    && Number.isFinite(trade.riskAmount)
    && Math.abs(trade.riskAmount) > 0
  ) {
    acc.rCount += 1;
    acc.rSum += pnl / Math.abs(trade.riskAmount);
  }
};

const publicStatsPayload = (acc: Accumulator) => ({
  totalTrades: acc.totalTrades,
  openTrades: acc.openTrades,
  closedTrades: acc.closedTrades,
  cancelledTrades: acc.cancelledTrades,
  closedWithPnl: acc.closedWithPnl,
  wins: acc.wins,
  losses: acc.losses,
  breakeven: acc.breakeven,
  totalPnl: acc.totalPnl,
  grossProfit: acc.grossProfit,
  grossLoss: acc.grossLoss,
  winPnlSum: acc.winPnlSum,
  lossAbsSum: acc.lossAbsSum,
  bestTrade: acc.bestTrade,
  worstTrade: acc.worstTrade,
  rCount: acc.rCount,
  rSum: acc.rSum,
  maxConsecutiveWins: acc.maxConsecutiveWins,
  maxConsecutiveLosses: acc.maxConsecutiveLosses,
  maxDrawdown: acc.maxDrawdown,
  processedTrades: acc.processedTrades,
});

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
      stale: stats.sourceVersion !== sourceVersion,
      sourceVersion,
    };
  },
});

export const ensureForJournal = mutation({
  args: { journalId: v.id("tradingAccounts") },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    const journal = await assertOwnedJournal(ctx, userId, args.journalId);
    const sourceVersion = journal.statsVersion ?? 0;
    const existingStats = await ctx.db
      .query("journalTradeStats")
      .withIndex("by_user_journal", (q) =>
        q.eq("userId", userId).eq("journalId", args.journalId),
      )
      .unique();

    if (existingStats?.sourceVersion === sourceVersion) {
      return { status: "ready" as const };
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("journalTradeStatsBackfills")
      .withIndex("by_user_journal", (q) =>
        q.eq("userId", userId).eq("journalId", args.journalId),
      )
      .unique();

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
