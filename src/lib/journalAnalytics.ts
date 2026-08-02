import type { JournalTrade } from "@/lib/convexJournal";
import type { JournalEntry } from "@/lib/calculatorHistory";

export interface JournalStats {
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  totalPnl: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  avgWinLossRatio: number | null;
  bestTrade: number | null;
  worstTrade: number | null;
  avgR: number | null;
}

export interface DailyPnlPoint {
  dateKey: string;
  label: string;
  pnl: number;
  trades: number;
}

export interface DayOfWeekPerformance {
  day: string;
  shortDay: string;
  wins: number;
  losses: number;
  total: number;
  winRate: number;
  pnl: number;
}

export interface CumulativePnlPoint {
  label: string;
  value: number;
}

export interface EquityCurvePoint {
  label: string;
  value: number;
  tradePnl: number;
  pair: string | null;
  dateKey: string;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const SHORT_DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getTradeDate = (trade: JournalTrade): Date | null => {
  const raw = trade.exit_date ?? trade.entry_date ?? trade.created_at;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getClosedPnl = (trade: JournalTrade): number | null => {
  if (trade.status !== "closed") return null;
  if (trade.pnl === null || trade.pnl === undefined || !Number.isFinite(trade.pnl)) return null;
  return trade.pnl;
};

const resolveCalculatorPnl = (item: JournalEntry): number | null => {
  if (item.status !== "win" && item.status !== "loss" && item.status !== "breakeven") {
    return null;
  }

  if (item.pnlAmount !== null && item.pnlAmount !== undefined && Number.isFinite(item.pnlAmount)) {
    return item.pnlAmount;
  }

  if (item.resultR !== null && item.resultR !== undefined && Number.isFinite(item.resultR)) {
    return item.resultR * (item.riskAmount || 0);
  }

  if (item.status === "win") return item.potentialProfit ?? item.riskAmount ?? 0;
  if (item.status === "loss") return -(item.actualRisk ?? item.riskAmount ?? 0);
  return 0;
};

const collectClosedPnlValues = (
  trades: JournalTrade[],
  calculatorResults: JournalEntry[] = [],
): number[] => {
  const values: number[] = [];

  for (const trade of trades) {
    const pnl = getClosedPnl(trade);
    if (pnl !== null) values.push(pnl);
  }

  for (const item of calculatorResults) {
    const pnl = resolveCalculatorPnl(item);
    if (pnl !== null) values.push(pnl);
  }

  return values;
};

export const computeJournalStats = (
  trades: JournalTrade[],
  calculatorResults: JournalEntry[] = [],
): JournalStats => {
  const closedManual = trades.filter((trade) => trade.status === "closed");
  const closedCalculator = calculatorResults.filter(
    (item) => item.status === "win" || item.status === "loss" || item.status === "breakeven",
  );
  const pnlValues = collectClosedPnlValues(trades, calculatorResults);

  const wins = pnlValues.filter((value) => value > 0).length;
  const losses = pnlValues.filter((value) => value < 0).length;
  const breakeven = pnlValues.filter((value) => value === 0).length;
  const totalPnl = pnlValues.reduce((sum, value) => sum + value, 0);
  const grossProfit = pnlValues.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(pnlValues.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  const winValues = pnlValues.filter((value) => value > 0);
  const lossValues = pnlValues.filter((value) => value < 0).map(Math.abs);
  const avgWin = winValues.length ? winValues.reduce((sum, value) => sum + value, 0) / winValues.length : null;
  const avgLoss = lossValues.length ? lossValues.reduce((sum, value) => sum + value, 0) / lossValues.length : null;

  return {
    totalTrades: trades.length + closedCalculator.length,
    closedTrades: closedManual.length + closedCalculator.length,
    openTrades: trades.filter((trade) => trade.status === "open").length,
    wins,
    losses,
    breakeven,
    winRate: pnlValues.length ? (wins / pnlValues.length) * 100 : 0,
    totalPnl,
    grossProfit,
    grossLoss,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? null : null,
    avgWin,
    avgLoss,
    avgWinLossRatio: avgWin !== null && avgLoss !== null && avgLoss > 0 ? avgWin / avgLoss : null,
    bestTrade: pnlValues.length ? Math.max(...pnlValues) : null,
    worstTrade: pnlValues.length ? Math.min(...pnlValues) : null,
    avgR: null,
  };
};

export const computeDailyPnl = (trades: JournalTrade[]): DailyPnlPoint[] => {
  const buckets = new Map<string, DailyPnlPoint>();

  for (const trade of trades) {
    const pnl = getClosedPnl(trade);
    const date = getTradeDate(trade);
    if (pnl === null || !date) continue;

    const dateKey = toDateKey(date);
    const existing = buckets.get(dateKey);
    if (existing) {
      existing.pnl += pnl;
      existing.trades += 1;
    } else {
      buckets.set(dateKey, {
        dateKey,
        label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        pnl,
        trades: 1,
      });
    }
  }

  return Array.from(buckets.values()).sort((left, right) => left.dateKey.localeCompare(right.dateKey));
};

export const computeCumulativePnl = (dailyPoints: DailyPnlPoint[]): CumulativePnlPoint[] => {
  let running = 0;
  return dailyPoints.map((point) => {
    running += point.pnl;
    return { label: point.label, value: running };
  });
};

/** Trade-by-trade equity curve so individual wins/losses show as rises and dips. */
export const computeEquityCurve = (
  trades: JournalTrade[],
  calculatorResults: JournalEntry[] = [],
  startingBalance = 0,
): EquityCurvePoint[] => {
  type TimedResult = {
    date: Date;
    pnl: number;
    pair: string;
    createdAt: string;
  };

  const timed: TimedResult[] = [];

  for (const trade of trades) {
    const pnl = getClosedPnl(trade);
    const date = getTradeDate(trade);
    if (pnl === null || !date) continue;
    timed.push({
      date,
      pnl,
      pair: trade.pair,
      createdAt: trade.created_at,
    });
  }

  for (const item of calculatorResults) {
    const pnl = resolveCalculatorPnl(item);
    if (pnl === null) continue;

    const date = item.closedAt ?? item.openedAt ?? item.updatedAt ?? item.createdAt;
    if (!date || Number.isNaN(date.getTime())) continue;

    timed.push({
      date,
      pnl,
      pair: item.symbol,
      createdAt: item.createdAt.toISOString(),
    });
  }

  timed.sort((left, right) => {
    const byDate = left.date.getTime() - right.date.getTime();
    if (byDate !== 0) return byDate;
    return left.createdAt.localeCompare(right.createdAt);
  });

  if (!timed.length && startingBalance <= 0) {
    return [];
  }

  let running = startingBalance;
  const points: EquityCurvePoint[] = [
    { label: "Start", value: startingBalance, tradePnl: 0, pair: null, dateKey: "" },
  ];

  for (const item of timed) {
    running += item.pnl;
    points.push({
      label: item.date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: running,
      tradePnl: item.pnl,
      pair: item.pair,
      dateKey: toDateKey(item.date),
    });
  }

  return points;
};

export const computeDayOfWeekPerformance = (trades: JournalTrade[]): DayOfWeekPerformance[] => {
  const buckets = new Map<number, DayOfWeekPerformance>();

  for (let index = 1; index <= 5; index += 1) {
    buckets.set(index, {
      day: DAY_NAMES[index],
      shortDay: SHORT_DAY_NAMES[index],
      wins: 0,
      losses: 0,
      total: 0,
      winRate: 0,
      pnl: 0,
    });
  }

  for (const trade of trades) {
    const pnl = getClosedPnl(trade);
    const date = getTradeDate(trade);
    if (pnl === null || !date) continue;

    const dayIndex = date.getDay();
    if (dayIndex === 0 || dayIndex === 6) continue;

    const bucket = buckets.get(dayIndex);
    if (!bucket) continue;

    bucket.total += 1;
    bucket.pnl += pnl;
    if (pnl > 0) bucket.wins += 1;
    else if (pnl < 0) bucket.losses += 1;
  }

  return Array.from(buckets.values()).map((bucket) => ({
    ...bucket,
    winRate: bucket.total ? (bucket.wins / bucket.total) * 100 : 0,
  }));
};

export const formatJournalMoney = (value: number | null | undefined, symbol = "$") => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${symbol}${Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const formatJournalPercent = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return `${value.toFixed(2)}%`;
};
