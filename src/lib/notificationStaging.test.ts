import { describe, expect, it } from "vitest";

import {
  CALENDAR_ALERT_LEAD_MS,
  NOTIFICATION_BATCH_LIMIT,
  SUBSCRIBER_ALERT_PAGE_SIZE,
  classifyPushFailure,
  isDuePending,
  planCalendarAlert,
  selectClaimBatch,
  shouldDrainAnotherBatch,
  type QueueCandidate,
} from "../../convex/lib/notificationStaging";

const now = 1_700_000_000_000;

function row(
  overrides: Partial<QueueCandidate> & Pick<QueueCandidate, "status" | "createdAtMs">,
): QueueCandidate {
  return {
    channel: "push",
    scheduledForMs: null,
    processingStartedAtMs: null,
    ...overrides,
  };
}

describe("notification delivery", () => {
  it("sends due alerts and holds ones that are not due yet", () => {
    const due = row({ status: "pending", createdAtMs: 2, scheduledForMs: now - 1 });
    const future = row({ status: "pending", createdAtMs: 1, scheduledForMs: now + 60_000 });

    const { claim } = selectClaimBatch({
      pending: [future, due],
      processing: [],
      now,
      limit: 10,
      staleAfterMs: 60_000,
    });

    expect(claim).toEqual([due]);
    expect(isDuePending(future, now)).toBe(false);
  });

  it("keeps draining while a batch is full", () => {
    expect(shouldDrainAnotherBatch(NOTIFICATION_BATCH_LIMIT, NOTIFICATION_BATCH_LIMIT)).toBe(true);
    expect(shouldDrainAnotherBatch(NOTIFICATION_BATCH_LIMIT - 1, NOTIFICATION_BATCH_LIMIT)).toBe(false);
  });

  it("reclaims a stuck send and leaves a fresh in-progress send alone", () => {
    const stale = row({
      status: "processing",
      createdAtMs: 1,
      processingStartedAtMs: now - 10 * 60 * 1000,
    });
    const fresh = row({
      status: "processing",
      createdAtMs: 2,
      processingStartedAtMs: now - 1_000,
    });

    const { claim } = selectClaimBatch({
      pending: [],
      processing: [fresh, stale],
      now,
      limit: 5,
      staleAfterMs: 5 * 60 * 1000,
    });

    expect(claim).toEqual([stale]);
  });

  it("retries a failed device and drops one the push service has forgotten", () => {
    expect(classifyPushFailure(404)).toBe("gone");
    expect(classifyPushFailure(410)).toBe("gone");
    expect(classifyPushFailure(429)).toBe("retry");
    expect(classifyPushFailure(500)).toBe("retry");
    expect(classifyPushFailure(null)).toBe("retry");
  });

  it("schedules a calendar alert for 15 minutes before the release", () => {
    const eventAt = now + 2 * 60 * 60 * 1000;
    const planned = planCalendarAlert(eventAt, now);
    expect(planned).toEqual({
      action: "send",
      scheduledForMs: eventAt - CALENDAR_ALERT_LEAD_MS,
    });

    if (planned.action !== "send" || planned.scheduledForMs == null) {
      throw new Error("expected a future send time");
    }

    const queued = row({
      status: "pending",
      createdAtMs: now,
      scheduledForMs: planned.scheduledForMs,
    });
    expect(isDuePending(queued, planned.scheduledForMs - 1)).toBe(false);
    expect(isDuePending(queued, planned.scheduledForMs)).toBe(true);
  });

  it("sends immediately inside the lead window and skips a release that already passed", () => {
    expect(planCalendarAlert(now + 5 * 60 * 1000, now)).toEqual({
      action: "send",
      scheduledForMs: null,
    });
    expect(planCalendarAlert(now - 2 * 60 * 60 * 1000, now)).toEqual({ action: "skip" });
    expect(SUBSCRIBER_ALERT_PAGE_SIZE).toBeLessThanOrEqual(40);
  });
});