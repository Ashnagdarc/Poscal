import type { JournalEntry } from "@/lib/calculatorHistory";

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

const toDateKey = (date: Date) => date.toISOString().slice(0, 10);

const parseDateKey = (dateKey: string) => new Date(`${dateKey}T12:00:00`);

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

export const buildResultDaySummaries = (items: JournalEntry[]) => {
  const summaries = new Map<string, ResultDaySummary>();
  const closedItems = items.filter((item) => item.status !== "open" && item.closedAt);

  for (const item of closedItems) {
    const closedAt = startOfDay(item.closedAt ?? item.updatedAt);
    const dateKey = toDateKey(closedAt);
    const existing = summaries.get(dateKey);
    const tradeCount = (existing?.tradeCount ?? 0) + 1;

    const dayItems = closedItems.filter(
      (entry) => entry.closedAt && isSameDay(entry.closedAt, closedAt),
    );

    const allHavePnl = dayItems.every(
      (entry) => entry.pnlAmount !== null && entry.pnlAmount !== undefined,
    );
    const allHaveResultR = dayItems.every(
      (entry) => entry.resultR !== null && entry.resultR !== undefined,
    );

    let tone: ResultDayTone = "neutral";
    let label = `${tradeCount}T`;

    if (allHavePnl && dayItems.length > 0) {
      const totalPnl = dayItems.reduce((sum, entry) => sum + (entry.pnlAmount ?? 0), 0);
      tone = totalPnl > 0 ? "positive" : totalPnl < 0 ? "negative" : "neutral";
      label = `${totalPnl > 0 ? "+" : totalPnl < 0 ? "-" : ""}$${Math.abs(totalPnl) >= 100 ? Math.abs(totalPnl).toFixed(0) : Math.abs(totalPnl).toFixed(1)}`;
    } else if (allHaveResultR && dayItems.length > 0) {
      const totalR = dayItems.reduce((sum, entry) => sum + (entry.resultR ?? 0), 0);
      tone = totalR > 0 ? "positive" : totalR < 0 ? "negative" : "neutral";
      label = formatDaySummaryAmount(totalR, "R");
    } else {
      const wins = dayItems.filter((entry) => entry.status === "win").length;
      const losses = dayItems.filter((entry) => entry.status === "loss").length;
      tone = wins > losses ? "positive" : losses > wins ? "negative" : "neutral";
      label = wins || losses ? `W${wins}/L${losses}` : `${tradeCount}T`;
    }

    summaries.set(dateKey, {
      dateKey,
      tradeCount,
      tone,
      label,
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
