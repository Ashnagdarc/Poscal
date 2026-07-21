import type { JournalTrade } from "@/lib/convexJournal";

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

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const SHORT_DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const toDateKey = (date: Date) => date.toISOString().slice(0, 10);

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

export const computeJournalStats = (trades: JournalTrade[]): JournalStats => {
  const closedTrades = trades.filter((trade) => trade.status === "closed");
  const pnlValues = closedTrades
    .map(getClosedPnl)
    .filter((value): value is number => value !== null);

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
    totalTrades: trades.length,
    closedTrades: closedTrades.length,
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
