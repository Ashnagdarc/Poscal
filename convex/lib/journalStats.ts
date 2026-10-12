import type { Doc } from "../_generated/dataModel";

export type Accumulator = {
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

export const emptyAccumulator = (): Accumulator => ({
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

export const fromBackfill = (row: Doc<"journalTradeStatsBackfills">): Accumulator => ({
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

export const accumulateTrade = (acc: Accumulator, trade: Doc<"tradingJournal">) => {
  if (trade.journalType === "notebook_draft") {
    return;
  }

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

export const publicStatsPayload = (acc: Accumulator) => ({
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

