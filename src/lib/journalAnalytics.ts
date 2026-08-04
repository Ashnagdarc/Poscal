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
  /** null when no closed P&L; Infinity when wins exist and grossLoss is 0 */
  profitFactor: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  avgWinLossRatio: number | null;
  bestTrade: number | null;
  worstTrade: number | null;
  /** Mean R multiple when per-trade R or risk amount is available */
  avgR: number | null;
  /** Expectancy = totalPnl / closed trades with P&L */
  expectancy: number | null;
  /** Max peak-to-trough drawdown in account currency (negative or zero) */
  maxDrawdown: number | null;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
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

export type TradingSessionId =
  | "asian"
  | "london"
  | "london_ny"
  | "new_york"
  | "off_hours";

export interface PerformanceBreakdownRow {
  key: string;
  label: string;
  trades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  pnl: number;
  expectancy: number | null;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const SHORT_DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const SESSION_ORDER: TradingSessionId[] = [
  "asian",
  "london",
  "london_ny",
  "new_york",
  "off_hours",
];

const SESSION_LABELS: Record<TradingSessionId, string> = {
  asian: "Asian",
  london: "London",
  london_ny: "London / NY overlap",
  new_york: "New York",
  off_hours: "Off hours",
};

/** Local calendar date key (browser timezone). Prefer `toDateKeyInTimeZone` when prefs exist. */
const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Calendar date key in an IANA timezone (e.g. America/New_York → YYYY-MM-DD).
 * Falls back to browser-local `toDateKey` when timezone is missing/invalid.
 */
export const toDateKeyInTimeZone = (date: Date, timeZone?: string | null): string => {
  if (!timeZone) return toDateKey(date);
  try {
    const formatted = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
    // en-CA yields YYYY-MM-DD in modern engines
    if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) return formatted;
  } catch {
    // invalid IANA zone
  }
  return toDateKey(date);
};

export const formatDateInTimeZone = (
  date: Date,
  timeZone?: string | null,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
): string => {
  try {
    return date.toLocaleDateString("en-US", {
      ...options,
      ...(timeZone ? { timeZone } : {}),
    });
  } catch {
    return date.toLocaleDateString("en-US", options);
  }
};

const getWeekdayIndexInTimeZone = (date: Date, timeZone?: string | null): number => {
  if (!timeZone) return date.getDay();
  try {
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
    }).format(date);
    const index = SHORT_DAY_NAMES.indexOf(weekday as (typeof SHORT_DAY_NAMES)[number]);
    return index >= 0 ? index : date.getDay();
  } catch {
    return date.getDay();
  }
};

/**
 * Mutually exclusive forex session buckets by UTC hour of entry/exit.
 * Windows: Asian 00–07, London 08–12, London/NY 13–16, NY 17–21, Off 22–23.
 */
export const classifyTradingSession = (date: Date): TradingSessionId => {
  const hour = date.getUTCHours();
  if (hour >= 0 && hour <= 7) return "asian";
  if (hour >= 8 && hour <= 12) return "london";
  if (hour >= 13 && hour <= 16) return "london_ny";
  if (hour >= 17 && hour <= 21) return "new_york";
  return "off_hours";
};

export const tradingSessionLabel = (session: TradingSessionId): string => SESSION_LABELS[session];

/** Normalize Tags / Setup into a single strategy key (case-insensitive trim). */
export const resolveStrategyKey = (tags?: string | null): string => {
  const trimmed = tags?.trim();
  if (!trimmed) return "Untagged";
  return trimmed.replace(/\s+/g, " ");
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

/**
 * Collect closed P&L values for stats.
 * By default ONLY manual journal trades are included (MC-030 / DR-005).
 * Pass `includeCalculatorHistory: true` only when explicitly analyzing calc saves.
 */
const collectClosedPnlValues = (
  trades: JournalTrade[],
  calculatorResults: JournalEntry[] = [],
  includeCalculatorHistory = false,
): number[] => {
  const values: number[] = [];

  for (const trade of trades) {
    const pnl = getClosedPnl(trade);
    if (pnl !== null) values.push(pnl);
  }

  if (includeCalculatorHistory) {
    for (const item of calculatorResults) {
      const pnl = resolveCalculatorPnl(item);
      if (pnl !== null) values.push(pnl);
    }
  }

  return values;
};

/** Chronological closed P&L for streak / drawdown math. */
const collectClosedPnlChronological = (
  trades: JournalTrade[],
  calculatorResults: JournalEntry[] = [],
  includeCalculatorHistory = false,
): number[] => {
  type Timed = { at: number; tie: string; pnl: number };
  const timed: Timed[] = [];

  for (const trade of trades) {
    const pnl = getClosedPnl(trade);
    const date = getTradeDate(trade);
    if (pnl === null || !date) continue;
    timed.push({ at: date.getTime(), tie: trade.created_at, pnl });
  }

  if (includeCalculatorHistory) {
    for (const item of calculatorResults) {
      const pnl = resolveCalculatorPnl(item);
      if (pnl === null) continue;
      const date = item.closedAt ?? item.openedAt ?? item.updatedAt ?? item.createdAt;
      if (!date || Number.isNaN(date.getTime())) continue;
      timed.push({ at: date.getTime(), tie: item.id, pnl });
    }
  }

  timed.sort((left, right) => {
    const byDate = left.at - right.at;
    if (byDate !== 0) return byDate;
    return left.tie.localeCompare(right.tie);
  });

  return timed.map((item) => item.pnl);
};

const computeMaxDrawdown = (chronologicalPnl: number[], startingBalance = 0): number | null => {
  if (!chronologicalPnl.length) return null;

  let equity = startingBalance;
  let peak = startingBalance;
  let maxDd = 0;

  for (const pnl of chronologicalPnl) {
    equity += pnl;
    if (equity > peak) peak = equity;
    const drawdown = equity - peak;
    if (drawdown < maxDd) maxDd = drawdown;
  }

  return maxDd;
};

const computeStreaks = (chronologicalPnl: number[]) => {
  let maxWins = 0;
  let maxLosses = 0;
  let winStreak = 0;
  let lossStreak = 0;

  for (const pnl of chronologicalPnl) {
    if (pnl > 0) {
      winStreak += 1;
      lossStreak = 0;
      if (winStreak > maxWins) maxWins = winStreak;
    } else if (pnl < 0) {
      lossStreak += 1;
      winStreak = 0;
      if (lossStreak > maxLosses) maxLosses = lossStreak;
    } else {
      winStreak = 0;
      lossStreak = 0;
    }
  }

  return { maxConsecutiveWins: maxWins, maxConsecutiveLosses: maxLosses };
};

const collectRMultiples = (
  trades: JournalTrade[],
  calculatorResults: JournalEntry[] = [],
): number[] => {
  const multiples: number[] = [];

  for (const trade of trades) {
    const pnl = getClosedPnl(trade);
    if (pnl === null) continue;

    if (
      trade.risk_amount != null
      && Number.isFinite(trade.risk_amount)
      && Math.abs(trade.risk_amount) > 0
    ) {
      multiples.push(pnl / Math.abs(trade.risk_amount));
    }
  }

  for (const item of calculatorResults) {
    if (item.status !== "win" && item.status !== "loss" && item.status !== "breakeven") {
      continue;
    }
    if (item.resultR != null && Number.isFinite(item.resultR)) {
      multiples.push(item.resultR);
      continue;
    }
    const risk = item.actualRisk ?? item.riskAmount;
    const pnl = resolveCalculatorPnl(item);
    if (pnl !== null && risk != null && Number.isFinite(risk) && Math.abs(risk) > 0) {
      multiples.push(pnl / Math.abs(risk));
    }
  }

  return multiples;
};

export const computeJournalStats = (
  trades: JournalTrade[],
  /**
   * Unused for P&L stats by default (MC-030 / DR-005). Kept for call-site
   * compatibility; pass results only to other chart helpers when needed.
   */
  _calculatorResults: JournalEntry[] = [],
  startingBalance = 0,
): JournalStats => {
  void _calculatorResults;
  const closedManual = trades.filter((trade) => trade.status === "closed");
  // Manual journal trades only — calculator history is a separate series.
  const pnlValues = collectClosedPnlValues(trades, [], false);
  const chronological = collectClosedPnlChronological(trades, [], false);

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
  const rMultiples = collectRMultiples(trades, []);
  const streaks = computeStreaks(chronological);

  let profitFactor: number | null = null;
  if (pnlValues.length === 0) {
    profitFactor = null;
  } else if (grossLoss > 0) {
    profitFactor = grossProfit / grossLoss;
  } else if (grossProfit > 0) {
    profitFactor = Number.POSITIVE_INFINITY;
  } else {
    profitFactor = null;
  }

  return {
    totalTrades: trades.length,
    closedTrades: closedManual.length,
    openTrades: trades.filter((trade) => trade.status === "open").length,
    wins,
    losses,
    breakeven,
    winRate: pnlValues.length ? (wins / pnlValues.length) * 100 : 0,
    totalPnl,
    grossProfit,
    grossLoss,
    profitFactor,
    avgWin,
    avgLoss,
    avgWinLossRatio: avgWin !== null && avgLoss !== null && avgLoss > 0 ? avgWin / avgLoss : null,
    bestTrade: pnlValues.length ? Math.max(...pnlValues) : null,
    worstTrade: pnlValues.length ? Math.min(...pnlValues) : null,
    avgR: rMultiples.length
      ? rMultiples.reduce((sum, value) => sum + value, 0) / rMultiples.length
      : null,
    expectancy: pnlValues.length ? totalPnl / pnlValues.length : null,
    maxDrawdown: computeMaxDrawdown(chronological, startingBalance),
    maxConsecutiveWins: streaks.maxConsecutiveWins,
    maxConsecutiveLosses: streaks.maxConsecutiveLosses,
  };
};

export const computeDailyPnl = (
  trades: JournalTrade[],
  timeZone?: string | null,
): DailyPnlPoint[] => {
  const buckets = new Map<string, DailyPnlPoint>();

  for (const trade of trades) {
    const pnl = getClosedPnl(trade);
    const date = getTradeDate(trade);
    if (pnl === null || !date) continue;

    const dateKey = toDateKeyInTimeZone(date, timeZone);
    const existing = buckets.get(dateKey);
    if (existing) {
      existing.pnl += pnl;
      existing.trades += 1;
    } else {
      buckets.set(dateKey, {
        dateKey,
        label: formatDateInTimeZone(date, timeZone, { month: "short", day: "numeric" }),
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
  timeZone?: string | null,
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
      label: formatDateInTimeZone(item.date, timeZone, { month: "short", day: "numeric" }),
      value: running,
      tradePnl: item.pnl,
      pair: item.pair,
      dateKey: toDateKeyInTimeZone(item.date, timeZone),
    });
  }

  return points;
};

export const computeDayOfWeekPerformance = (
  trades: JournalTrade[],
  timeZone?: string | null,
): DayOfWeekPerformance[] => {
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

    const dayIndex = getWeekdayIndexInTimeZone(date, timeZone);
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

const emptyBreakdownRow = (key: string, label: string): PerformanceBreakdownRow => ({
  key,
  label,
  trades: 0,
  wins: 0,
  losses: 0,
  breakeven: 0,
  winRate: 0,
  pnl: 0,
  expectancy: null,
});

const finalizeBreakdownRows = (
  buckets: Map<string, PerformanceBreakdownRow>,
): PerformanceBreakdownRow[] => {
  return Array.from(buckets.values())
    .map((row) => ({
      ...row,
      winRate: row.trades ? (row.wins / row.trades) * 100 : 0,
      expectancy: row.trades ? row.pnl / row.trades : null,
    }))
    .sort((left, right) => {
      if (right.pnl !== left.pnl) return right.pnl - left.pnl;
      return left.label.localeCompare(right.label);
    });
};

const accumulateBreakdownTrade = (
  buckets: Map<string, PerformanceBreakdownRow>,
  key: string,
  label: string,
  pnl: number,
) => {
  const existing = buckets.get(key) ?? emptyBreakdownRow(key, label);
  existing.trades += 1;
  existing.pnl += pnl;
  if (pnl > 0) existing.wins += 1;
  else if (pnl < 0) existing.losses += 1;
  else existing.breakeven += 1;
  buckets.set(key, existing);
};

/** Performance by Tags / Setup (strategy). Untagged when empty. */
export const computeStrategyBreakdown = (trades: JournalTrade[]): PerformanceBreakdownRow[] => {
  const buckets = new Map<string, PerformanceBreakdownRow>();

  for (const trade of trades) {
    const pnl = getClosedPnl(trade);
    if (pnl === null) continue;
    const label = resolveStrategyKey(trade.tags);
    const key = label.toLowerCase();
    accumulateBreakdownTrade(buckets, key, label === "Untagged" ? "Untagged" : label, pnl);
  }

  return finalizeBreakdownRows(buckets);
};

/** Performance by instrument / pair. */
export const computeInstrumentBreakdown = (trades: JournalTrade[]): PerformanceBreakdownRow[] => {
  const buckets = new Map<string, PerformanceBreakdownRow>();

  for (const trade of trades) {
    const pnl = getClosedPnl(trade);
    if (pnl === null) continue;
    const label = trade.pair?.trim() || "Unknown";
    const key = label.toUpperCase();
    accumulateBreakdownTrade(buckets, key, label, pnl);
  }

  return finalizeBreakdownRows(buckets);
};

/**
 * Performance by forex session (UTC hour of trade date).
 * Prefers exit_date, then entry_date, then created_at — same as other analytics.
 */
export const computeSessionBreakdown = (trades: JournalTrade[]): PerformanceBreakdownRow[] => {
  const buckets = new Map<string, PerformanceBreakdownRow>();
  for (const session of SESSION_ORDER) {
    buckets.set(session, emptyBreakdownRow(session, SESSION_LABELS[session]));
  }

  for (const trade of trades) {
    const pnl = getClosedPnl(trade);
    const date = getTradeDate(trade);
    if (pnl === null || !date) continue;
    const session = classifyTradingSession(date);
    accumulateBreakdownTrade(buckets, session, SESSION_LABELS[session], pnl);
  }

  return SESSION_ORDER.map((session) => {
    const row = buckets.get(session) ?? emptyBreakdownRow(session, SESSION_LABELS[session]);
    return {
      ...row,
      winRate: row.trades ? (row.wins / row.trades) * 100 : 0,
      expectancy: row.trades ? row.pnl / row.trades : null,
    };
  });
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

export const formatProfitFactor = (value: number | null | undefined) => {
  if (value === Number.POSITIVE_INFINITY) return "∞";
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return value.toFixed(2);
};

export const formatJournalR = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}R`;
};
