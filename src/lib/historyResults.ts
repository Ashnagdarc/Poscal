import type { JournalEntry } from "@/lib/calculatorHistory";
import type { JournalTrade } from "@/lib/convexJournal";

export type ResultDayTone = "positive" | "negative" | "neutral" | "missed" | "none";

export interface ResultDaySummary {
  dateKey: string;
  tradeCount: number;
  tone: ResultDayTone;
  label: string;
}

export interface ResultHeatmapDay {
  dateKey: string;
  tone: ResultDayTone;
  label: string;
  tradeCount: number;
}

interface NormalizedResult {
  date: Date;
  status: "win" | "loss" | "breakeven" | "cancelled";
  pnlAmount: number | null;
  resultR: number | null;
}

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
};

export const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const isSameDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear()
  && left.getMonth() === right.getMonth()
  && left.getDate() === right.getDate();

const formatDaySummaryAmount = (value: number, suffix = "") => {
  const absoluteValue = Math.abs(value);
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  const fixed = absoluteValue >= 100 ? absoluteValue.toFixed(0) : absoluteValue.toFixed(1);
  return `${prefix}${fixed}${suffix}`;
};

const resolveCalculatorResultDate = (item: JournalEntry) => {
  if (item.closedAt) return startOfDay(item.closedAt);
  if (item.openedAt) return startOfDay(item.openedAt);
  return startOfDay(item.updatedAt ?? item.createdAt);
};

const normalizeCalculatorResults = (items: JournalEntry[]): NormalizedResult[] => {
  return items
    .filter((item) => item.status === "win" || item.status === "loss" || item.status === "breakeven" || item.status === "cancelled")
    .map((item) => ({
      date: resolveCalculatorResultDate(item),
      status: item.status as NormalizedResult["status"],
      pnlAmount: item.pnlAmount ?? null,
      resultR: item.resultR ?? null,
    }));
};

const normalizeManualTrades = (trades: JournalTrade[]): NormalizedResult[] => {
  return trades
    .filter((trade) => trade.status === "closed")
    .map((trade) => {
      const rawDate = trade.exit_date ?? trade.entry_date ?? trade.created_at;
      const pnl = trade.pnl;
      const status: NormalizedResult["status"] =
        pnl === null || pnl === undefined
          ? "breakeven"
          : pnl > 0
            ? "win"
            : pnl < 0
              ? "loss"
              : "breakeven";

      return {
        date: startOfDay(new Date(rawDate)),
        status,
        pnlAmount: pnl ?? 0,
        resultR: null,
      };
    })
    .filter((item) => !Number.isNaN(item.date.getTime()));
};

const summarizeDay = (dayItems: NormalizedResult[]): Omit<ResultDaySummary, "dateKey"> => {
  const tradeCount = dayItems.length;
  const allHavePnl = dayItems.every((entry) => entry.pnlAmount !== null && entry.pnlAmount !== undefined);
  const allHaveResultR = dayItems.every((entry) => entry.resultR !== null && entry.resultR !== undefined);

  if (allHavePnl && dayItems.length > 0) {
    const totalPnl = dayItems.reduce((sum, entry) => sum + (entry.pnlAmount ?? 0), 0);
    return {
      tradeCount,
      tone: totalPnl > 0 ? "positive" : totalPnl < 0 ? "negative" : "neutral",
      label: `${totalPnl > 0 ? "+" : totalPnl < 0 ? "-" : ""}$${Math.abs(totalPnl) >= 100 ? Math.abs(totalPnl).toFixed(0) : Math.abs(totalPnl).toFixed(1)}`,
    };
  }

  if (allHaveResultR && dayItems.length > 0) {
    const totalR = dayItems.reduce((sum, entry) => sum + (entry.resultR ?? 0), 0);
    return {
      tradeCount,
      tone: totalR > 0 ? "positive" : totalR < 0 ? "negative" : "neutral",
      label: formatDaySummaryAmount(totalR, "R"),
    };
  }

  const wins = dayItems.filter((entry) => entry.status === "win").length;
  const losses = dayItems.filter((entry) => entry.status === "loss").length;

  return {
    tradeCount,
    tone: wins > losses ? "positive" : losses > wins ? "negative" : "neutral",
    label: wins || losses ? `W${wins}/L${losses}` : `${tradeCount}T`,
  };
};

export const buildResultDaySummaries = (
  items: JournalEntry[],
  manualTrades: JournalTrade[] = [],
) => {
  const summaries = new Map<string, ResultDaySummary>();
  const normalized = [
    ...normalizeCalculatorResults(items),
    ...normalizeManualTrades(manualTrades),
  ];

  const byDay = new Map<string, NormalizedResult[]>();
  for (const item of normalized) {
    const dateKey = toDateKey(item.date);
    const bucket = byDay.get(dateKey);
    if (bucket) {
      bucket.push(item);
    } else {
      byDay.set(dateKey, [item]);
    }
  }

  for (const [dateKey, dayItems] of byDay) {
    summaries.set(dateKey, {
      dateKey,
      ...summarizeDay(dayItems),
    });
  }

  return summaries;
};

export const buildResultHeatmapDays = (
  summaries: Map<string, ResultDaySummary>,
  today: Date,
  rangeDays = 120,
): ResultHeatmapDay[] => {
  const end = startOfDay(today);
  const start = new Date(end);
  start.setDate(start.getDate() - rangeDays);

  const days: ResultHeatmapDay[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    const dateKey = toDateKey(cursor);
    const summary = summaries.get(dateKey);

    days.push({
      dateKey,
      tone: summary?.tone ?? (cursor < end ? "missed" : "none"),
      label: summary?.label ?? "",
      tradeCount: summary?.tradeCount ?? 0,
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
};

export interface MonthlyReturnsGrid {
  years: number[];
  returns: number[][];
}

/** Build years × months percent returns from closed trades and calculator results. */
export const buildMonthlyReturnsGrid = (
  items: JournalEntry[],
  manualTrades: JournalTrade[] = [],
  today: Date = new Date(),
  startingBalance?: number | null,
): MonthlyReturnsGrid => {
  const normalized = [
    ...normalizeCalculatorResults(items),
    ...normalizeManualTrades(manualTrades),
  ];

  const capitalCandidates = items
    .map((item) => item.accountBalance)
    .filter((value): value is number => typeof value === "number" && value > 0);
  const baseCapital =
    startingBalance && startingBalance > 0
      ? startingBalance
      : capitalCandidates.length
        ? capitalCandidates.reduce((sum, value) => sum + value, 0) / capitalCandidates.length
        : 10000;

  const monthlyPnl = new Map<string, number>();
  for (const item of normalized) {
    if (item.pnlAmount === null || item.pnlAmount === undefined) continue;
    const key = `${item.date.getFullYear()}-${item.date.getMonth()}`;
    monthlyPnl.set(key, (monthlyPnl.get(key) ?? 0) + item.pnlAmount);
  }

  const currentYear = today.getFullYear();
  let minYear = currentYear;
  let maxYear = currentYear;

  for (const item of normalized) {
    const year = item.date.getFullYear();
    minYear = Math.min(minYear, year);
    maxYear = Math.max(maxYear, year);
  }

  // Keep a short readable window when history is sparse.
  if (maxYear - minYear < 2) {
    minYear = Math.max(minYear - 1, currentYear - 4);
  }

  const years: number[] = [];
  for (let year = minYear; year <= maxYear; year += 1) {
    years.push(year);
  }

  const returns = years.map((year) =>
    Array.from({ length: 12 }, (_, month) => {
      const pnl = monthlyPnl.get(`${year}-${month}`) ?? 0;
      return Math.round((pnl / baseCapital) * 1000) / 10;
    }),
  );

  return { years, returns };
};

export const formatResultDayTooltip = (
  day: ResultHeatmapDay,
  today: Date,
) => {
  const date = parseDateKey(day.dateKey);
  const label = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  if (day.tone === "positive") {
    return `${label} · Profitable · ${day.label}`;
  }
  if (day.tone === "negative") {
    return `${label} · Losing · ${day.label}`;
  }
  if (day.tone === "neutral") {
    return `${label} · Breakeven · ${day.label}`;
  }
  if (day.tone === "missed" && startOfDay(date) < startOfDay(today)) {
    return `${label} · No closed results`;
  }
  return `${label} · No activity`;
};

export const resultToneClassName = (tone: ResultDayTone) => {
  switch (tone) {
    case "positive":
      return "bg-emerald-500 hover:bg-emerald-400";
    case "negative":
      return "bg-red-500 hover:bg-red-400";
    case "neutral":
      return "bg-slate-400 hover:bg-slate-300";
    case "missed":
      return "bg-secondary/70 hover:bg-secondary border border-border/60";
    case "none":
      return "bg-secondary/50 hover:bg-secondary border border-border/40";
    default: {
      const _exhaustive: never = tone;
      return _exhaustive;
    }
  }
};

export { toDateKey, parseDateKey };
