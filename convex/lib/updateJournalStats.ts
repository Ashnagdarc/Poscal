import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { accumulateTrade, emptyAccumulator, publicStatsPayload } from "./journalStats";

export type TradeChange = {
  before: Doc<"tradingJournal"> | null;
  after: Doc<"tradingJournal"> | null;
};

const additiveKeys = [
  "totalTrades", "openTrades", "closedTrades", "cancelledTrades", "closedWithPnl",
  "wins", "losses", "breakeven", "totalPnl", "grossProfit", "grossLoss",
  "winPnlSum", "lossAbsSum", "rCount", "rSum", "processedTrades",
] as const;

/** Runs inside the source write transaction; never publishes a delta onto a stale base. */
export async function updateJournalStats(
  ctx: MutationCtx,
  userId: string,
  journalId: Id<"tradingAccounts">,
  previousVersion: number,
  nextVersion: number,
  changes: TradeChange[],
) {
  const stats = await ctx.db.query("journalTradeStats")
    .withIndex("by_user_journal", q => q.eq("userId", userId).eq("journalId", journalId))
    .unique();
  if (!stats || stats.sourceVersion !== previousVersion) return;

  const acc = { ...emptyAccumulator(), ...stats, ...stats.appendState };
  const inserts = changes.flatMap(change => change.before === null && change.after ? [change.after] : []);
  let appendOnly = inserts.length === changes.length && inserts.length > 0
    && Boolean(stats.appendState) && !stats.orderedMetricsStale;
  if (appendOnly) {
    const latest = await ctx.db.query("tradingJournal")
      .withIndex("by_user_journal_created", q => q.eq("userId", userId).eq("journalId", journalId))
      .order("desc").take(inserts.length);
    const ids = new Set(inserts.map(trade => trade._id));
    appendOnly = latest.length === inserts.length && latest.every(trade => ids.has(trade._id));
    if (appendOnly) {
      for (const trade of latest.reverse()) accumulateTrade(acc, trade);
    }
  }

  if (!appendOnly) {
    for (const change of changes) {
      const before = emptyAccumulator();
      const after = emptyAccumulator();
      if (change.before) accumulateTrade(before, change.before);
      if (change.after) accumulateTrade(after, change.after);
      for (const key of additiveKeys) acc[key] += after[key] - before[key];
    }
  }

  await ctx.db.patch(stats._id, {
    ...publicStatsPayload(acc),
    sourceVersion: nextVersion,
    orderedMetricsStale: !appendOnly,
    appendState: appendOnly ? {
      currentWinStreak: acc.currentWinStreak,
      currentLossStreak: acc.currentLossStreak,
      runningPnl: acc.runningPnl,
      peakPnl: acc.peakPnl,
    } : undefined,
    updatedAtMs: Date.now(),
  });
}
