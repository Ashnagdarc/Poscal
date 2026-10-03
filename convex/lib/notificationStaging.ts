/** Calendar pushes go out this long before the release. */
export const CALENDAR_ALERT_LEAD_MS = 15 * 60 * 1000;

/** A release that already started can still be announced inside this window. */
export const CALENDAR_ALERT_GRACE_MS = 30 * 60 * 1000;

/** One worker pass. A full pass schedules another so the rest still go out. */
export const NOTIFICATION_BATCH_LIMIT = 50;

/** Device rows written per enqueue transaction. The next page continues the rest. */
export const SUBSCRIBER_ALERT_PAGE_SIZE = 25;

export type NotificationChannel = "push" | "email" | "in_app";

export type QueueCandidate = {
  status: "pending" | "processing" | "sent" | "failed";
  channel?: NotificationChannel;
  scheduledForMs?: number | null;
  processingStartedAtMs?: number | null;
  createdAtMs: number;
};

export type CalendarAlertPlan =
  | { action: "skip" }
  | { action: "send"; scheduledForMs: number | null };

export type PushFailureKind = "gone" | "retry";

export function isDuePending(row: QueueCandidate, now: number): boolean {
  if (row.status !== "pending") return false;
  return row.scheduledForMs == null || row.scheduledForMs <= now;
}

export function isStaleProcessing(row: QueueCandidate, now: number, staleAfterMs: number): boolean {
  if (row.status !== "processing") return false;
  if (row.processingStartedAtMs == null) return false;
  return row.processingStartedAtMs <= now - staleAfterMs;
}

function byCreatedAt(left: QueueCandidate, right: QueueCandidate): number {
  return left.createdAtMs - right.createdAtMs;
}

/** Due rows are claimed in time order. Future rows stay pending until their time. */
export function selectClaimBatch<T extends QueueCandidate>(input: {
  pending: T[];
  processing: T[];
  now: number;
  limit: number;
  staleAfterMs: number;
}): { claim: T[] } {
  const due = input.pending.filter((row) => isDuePending(row, input.now)).sort(byCreatedAt);
  const stale = input.processing
    .filter((row) => isStaleProcessing(row, input.now, input.staleAfterMs))
    .sort(byCreatedAt);
  return { claim: [...due, ...stale].slice(0, Math.max(0, input.limit)) };
}

/** A full batch means more due work may still be waiting, so the worker should run again. */
export function shouldDrainAnotherBatch(claimedCount: number, limit: number): boolean {
  return limit > 0 && claimedCount >= limit;
}

/** 404/410 means the device is gone. Anything else can be retried for that same device. */
export function classifyPushFailure(statusCode: number | null): PushFailureKind {
  if (statusCode === 404 || statusCode === 410) return "gone";
  return "retry";
}

export function planCalendarAlert(eventScheduledAtMs: number, now: number): CalendarAlertPlan {
  if (eventScheduledAtMs < now - CALENDAR_ALERT_GRACE_MS) {
    return { action: "skip" };
  }

  const sendAt = eventScheduledAtMs - CALENDAR_ALERT_LEAD_MS;
  if (sendAt <= now) {
    return { action: "send", scheduledForMs: null };
  }

  return { action: "send", scheduledForMs: sendAt };
}
