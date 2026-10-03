import { describe, expect, it } from "vitest";
import {
  dayKind,
  impactSummary,
  isCurrentRelease,
  parseCalendarNumber,
  releaseTiming,
  releaseVerdict,
  shortRelative,
  splitDayReleases,
} from "./calendarRelease";

const HOUR = 60 * 60 * 1000;

describe("calendar release timing", () => {
  const now = Date.parse("2026-10-03T15:00:00");

  it("keeps upcoming and just-released events current, and fades older ones", () => {
    expect(releaseTiming(now + 5 * 60_000, now)).toBe("upcoming");
    expect(releaseTiming(now - 30 * 60_000, now)).toBe("recent");
    expect(releaseTiming(now - 3 * HOUR, now)).toBe("past");
    expect(isCurrentRelease("recent")).toBe(true);
    expect(isCurrentRelease("past")).toBe(false);
  });

  it("puts today's passed releases below the recent ones", () => {
    const events = [
      { id: "old", scheduledAtMs: now - 5 * HOUR },
      { id: "fresh", scheduledAtMs: now - 20 * 60_000 },
      { id: "next", scheduledAtMs: now + HOUR },
    ];
    expect(splitDayReleases(events, now, "today")).toEqual({
      current: [events[1], events[2]],
      earlier: [events[0]],
    });
    expect(splitDayReleases(events, now, "past").current).toEqual([]);
    expect(splitDayReleases(events, now, "future").earlier).toEqual([]);
  });

  it("classifies the selected day against today", () => {
    expect(dayKind(now, now)).toBe("today");
    expect(dayKind(now - 24 * HOUR, now)).toBe("past");
    expect(dayKind(now + 24 * HOUR, now)).toBe("future");
  });

  it("formats a short countdown", () => {
    expect(shortRelative(now + 90 * 60_000, now)).toBe("In 1h 30m");
    expect(shortRelative(now - 12 * 60_000, now)).toBe("12m ago");
  });

  it("compares a print with the forecast", () => {
    expect(parseCalendarNumber("180K")).toBe(180_000);
    expect(releaseVerdict("3.8%", "3.6%")).toBe("Above forecast");
    expect(releaseVerdict("1.5%", "1.5%")).toBe("In line with forecast");
    expect(releaseVerdict("180K", "3.6%")).toBeNull();
  });

  it("explains impact in plain language", () => {
    expect(impactSummary("high")).toMatch(/High impact/);
    expect(impactSummary("holiday")).toMatch(/Holiday/);
  });
});
