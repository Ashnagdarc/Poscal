/**
 * UTC forex session opens used for push reminders.
 * Windows match journal analytics buckets (Asian / London / overlap / NY).
 */

export type TradingSessionAlertId = "asian" | "london" | "london_ny" | "new_york";

export type TradingSessionOpen = {
  id: TradingSessionAlertId;
  label: string;
  /** UTC hour when the session opens. */
  openHourUtc: number;
};

export const TRADING_SESSION_OPENS: readonly TradingSessionOpen[] = [
  { id: "asian", label: "Asian session", openHourUtc: 0 },
  { id: "london", label: "London session", openHourUtc: 8 },
  { id: "london_ny", label: "London / NY overlap", openHourUtc: 13 },
  { id: "new_york", label: "New York session", openHourUtc: 17 },
] as const;

/** Cron may lag a few minutes; still announce within this window after the open. */
export const SESSION_ALERT_GRACE_MS = 5 * 60 * 1000;

/** Evening journal-log nudge hour in the trader's local timezone. */
export const JOURNAL_LOG_REMINDER_LOCAL_HOUR = 20;

export function utcDateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function dateKeyInTimeZone(ms: number, timeZone: string): string | null {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(ms));
  } catch {
    return null;
  }
}

export function localHourInTimeZone(ms: number, timeZone: string): number | null {
  try {
    const hour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "numeric",
        hourCycle: "h23",
      }).format(new Date(ms)),
    );
    return Number.isFinite(hour) ? hour : null;
  } catch {
    return null;
  }
}

/**
 * Returns the session that opened in [now - grace, now], if any.
 * Used by the minute cron so a delayed tick still fires once.
 */
export function sessionOpenDueAt(
  nowMs: number,
  graceMs: number = SESSION_ALERT_GRACE_MS,
): TradingSessionOpen | null {
  const now = new Date(nowMs);
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();
  const second = now.getUTCSeconds();
  const msIntoHour = ((minute * 60) + second) * 1000 + (nowMs % 1000);

  if (msIntoHour > graceMs) return null;

  return TRADING_SESSION_OPENS.find((session) => session.openHourUtc === hour) ?? null;
}

export function sessionAlertDeliveryKey(sessionId: TradingSessionAlertId, dayKey: string): string {
  return `${sessionId}-${dayKey}`;
}

export function journalLogReminderDeliveryKey(userId: string, dayKey: string): string {
  return `journal-log-${userId}-${dayKey}`;
}

export function isJournalLogReminderHour(
  nowMs: number,
  timeZone: string | null | undefined,
  targetHour: number = JOURNAL_LOG_REMINDER_LOCAL_HOUR,
): { due: boolean; dayKey: string } {
  const zone = timeZone?.trim() || "UTC";
  const hour = localHourInTimeZone(nowMs, zone);
  const dayKey = dateKeyInTimeZone(nowMs, zone) ?? utcDateKey(nowMs);
  if (hour == null) {
    return { due: false, dayKey };
  }
  return { due: hour === targetHour, dayKey };
}
