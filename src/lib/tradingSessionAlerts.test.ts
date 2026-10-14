import { describe, expect, it } from "vitest";

import {
  isJournalLogReminderHour,
  sessionAlertDeliveryKey,
  sessionOpenDueAt,
  utcDateKey,
} from "../../convex/lib/tradingSessionAlerts";

describe("trading session alerts", () => {
  it("detects London open inside the grace window", () => {
    const londonOpen = Date.UTC(2026, 9, 14, 8, 2, 0);
    const due = sessionOpenDueAt(londonOpen);
    expect(due?.id).toBe("london");
    expect(sessionAlertDeliveryKey("london", utcDateKey(londonOpen))).toBe("london-2026-10-14");
  });

  it("ignores session opens outside the grace window", () => {
    const tooLate = Date.UTC(2026, 9, 14, 8, 10, 0);
    expect(sessionOpenDueAt(tooLate)).toBeNull();
  });

  it("marks evening journal reminder hour in a timezone", () => {
    // 20:00 in London on 2026-10-14 = 19:00 UTC (BST ended? Oct 14 2026 is BST until late Oct)
    // Use America/New_York to avoid DST ambiguity in the assertion on hour only.
    const nyEvening = Date.UTC(2026, 9, 14, 0, 30, 0); // 20:30 previous evening EDT (UTC-4)
    // Safer: construct via a known UTC that maps to 20:00 New York in standard winter.
    const winterNy = Date.UTC(2026, 0, 15, 1, 0, 0); // 20:00 America/New_York (EST)
    const result = isJournalLogReminderHour(winterNy, "America/New_York");
    expect(result.due).toBe(true);
    expect(result.dayKey).toBe("2026-01-14");
  });

  it("does not fire journal reminder outside the local hour", () => {
    const noonUtc = Date.UTC(2026, 0, 15, 12, 0, 0);
    expect(isJournalLogReminderHour(noonUtc, "UTC").due).toBe(false);
  });
});
