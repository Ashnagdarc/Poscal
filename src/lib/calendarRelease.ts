/** Releases inside this window after they print still count as recent. */
export const RECENT_WINDOW_MS = 2 * 60 * 60 * 1000;

export type ImpactTone = "high" | "medium" | "low" | "holiday";
export type ReleaseTiming = "upcoming" | "recent" | "past";
export type DayKind = "past" | "today" | "future";

const CURRENCY_LABELS: Record<string, string> = {
  USD: "US dollar",
  EUR: "Euro",
  GBP: "British pound",
  JPY: "Japanese yen",
  AUD: "Australian dollar",
  NZD: "New Zealand dollar",
  CAD: "Canadian dollar",
  CHF: "Swiss franc",
  CNY: "Chinese yuan",
};

const SUFFIX: Record<string, number> = {
  k: 1_000,
  m: 1_000_000,
  b: 1_000_000_000,
};

export function impactTone(impact: string): ImpactTone {
  switch (impact.toLowerCase()) {
    case "high":
      return "high";
    case "medium":
      return "medium";
    case "holiday":
      return "holiday";
    case "low":
    default:
      return "low";
  }
}

export function toneLabel(tone: ImpactTone): string {
  switch (tone) {
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
    case "holiday":
      return "Holiday";
    default: {
      const exhaustive: never = tone;
      return exhaustive;
    }
  }
}

export function impactSummary(tone: ImpactTone): string {
  switch (tone) {
    case "high":
      return "High impact. A surprise here often moves the currency.";
    case "medium":
      return "Medium impact. Price can react if the print misses the forecast.";
    case "low":
      return "Low impact. Usually a smaller move, unless it surprises.";
    case "holiday":
      return "Holiday or clock change. No figure, and liquidity can be thin.";
    default: {
      const exhaustive: never = tone;
      return exhaustive;
    }
  }
}

export function currencyLabel(country: string): string {
  const code = country.trim().toUpperCase();
  return CURRENCY_LABELS[code] ?? code;
}

export function releaseTiming(scheduledAtMs: number, nowMs: number): ReleaseTiming {
  if (scheduledAtMs > nowMs) return "upcoming";
  if (nowMs - scheduledAtMs <= RECENT_WINDOW_MS) return "recent";
  return "past";
}

export function isCurrentRelease(timing: ReleaseTiming): boolean {
  switch (timing) {
    case "upcoming":
    case "recent":
      return true;
    case "past":
      return false;
    default: {
      const exhaustive: never = timing;
      return exhaustive;
    }
  }
}

export function dayKind(dayMs: number, nowMs: number): DayKind {
  const day = startOfLocalDay(dayMs);
  const today = startOfLocalDay(nowMs);
  if (day < today) return "past";
  if (day > today) return "future";
  return "today";
}

export function splitDayReleases<T extends { scheduledAtMs: number }>(
  events: readonly T[],
  nowMs: number,
  kind: DayKind,
): { current: T[]; earlier: T[] } {
  switch (kind) {
    case "past":
      return { current: [], earlier: [...events] };
    case "future":
      return { current: [...events], earlier: [] };
    case "today": {
      const current: T[] = [];
      const earlier: T[] = [];
      for (const event of events) {
        if (isCurrentRelease(releaseTiming(event.scheduledAtMs, nowMs))) {
          current.push(event);
        } else {
          earlier.push(event);
        }
      }
      return { current, earlier };
    }
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

export function shortRelative(scheduledAtMs: number, nowMs: number): string {
  const delta = scheduledAtMs - nowMs;
  const minutes = Math.round(Math.abs(delta) / 60_000);
  if (minutes < 1) return delta >= 0 ? "Now" : "Just now";
  if (minutes < 60) return delta >= 0 ? `In ${minutes}m` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  const body = remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return delta >= 0 ? `In ${days}d` : `${days}d ago`;
  }
  return delta >= 0 ? `In ${body}` : `${body} ago`;
}

export function parseCalendarNumber(raw: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/,/g, "").replace(/%/g, "");
  const match = cleaned.match(/^([+-]?\d+(?:\.\d+)?)([kmb])?$/i);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  const suffix = match[2]?.toLowerCase();
  return suffix ? value * SUFFIX[suffix] : value;
}

export function releaseVerdict(actual: string | null, estimate: string | null): string | null {
  if (!actual || !estimate) return null;
  if (actual.includes("%") !== estimate.includes("%")) return null;
  const printed = parseCalendarNumber(actual);
  const forecast = parseCalendarNumber(estimate);
  if (printed === null || forecast === null) return null;
  const epsilon = Math.max(Math.abs(forecast) * 0.0001, 1e-9);
  if (Math.abs(printed - forecast) <= epsilon) return "In line with forecast";
  return printed > forecast ? "Above forecast" : "Below forecast";
}

export function formatZoneClock(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(ms);
}

export function isForexFactoryDetailUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "www.forexfactory.com";
  } catch {
    return false;
  }
}

function startOfLocalDay(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
