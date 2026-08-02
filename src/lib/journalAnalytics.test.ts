import { describe, expect, it } from "vitest";
import type { JournalTrade } from "@/lib/convexJournal";
import {
  classifyTradingSession,
  computeInstrumentBreakdown,
  computeJournalStats,
  computeSessionBreakdown,
  computeStrategyBreakdown,
  formatProfitFactor,
  resolveStrategyKey,
  toDateKeyInTimeZone,
} from "@/lib/journalAnalytics";

const trade = (
  overrides: Partial<JournalTrade> & Pick<JournalTrade, "id" | "pnl">,
): JournalTrade => ({
  pair: "EUR/USD",
  direction: "buy",
  entry_price: 1.1,
  exit_price: 1.2,
  stop_loss: null,
  take_profit: null,
  position_size: 1,
  risk_percent: 1,
  status: "closed",
  notes: null,
  entry_date: "2026-08-01T10:00:00.000Z",
  exit_date: "2026-08-01T12:00:00.000Z",
  created_at: "2026-08-01T10:00:00.000Z",
  ...overrides,
});

describe("computeJournalStats", () => {
  it("computes expectancy, profit factor infinity, and streaks for all-wins", () => {
    const trades = [
      trade({ id: "1", pnl: 100, exit_date: "2026-08-01T12:00:00.000Z", risk_amount: 50 }),
      trade({ id: "2", pnl: 50, exit_date: "2026-08-02T12:00:00.000Z", risk_amount: 50 }),
      trade({ id: "3", pnl: 25, exit_date: "2026-08-03T12:00:00.000Z", risk_amount: 25 }),
    ];

    const stats = computeJournalStats(trades, [], 1000);

    expect(stats.expectancy).toBeCloseTo(175 / 3, 5);
    expect(stats.profitFactor).toBe(Number.POSITIVE_INFINITY);
    expect(formatProfitFactor(stats.profitFactor)).toBe("∞");
    expect(stats.maxConsecutiveWins).toBe(3);
    expect(stats.maxConsecutiveLosses).toBe(0);
    expect(stats.avgR).toBeCloseTo((2 + 1 + 1) / 3, 5);
  });

  it("computes max drawdown from chronological equity", () => {
    const trades = [
      trade({ id: "1", pnl: 100, exit_date: "2026-08-01T12:00:00.000Z" }),
      trade({ id: "2", pnl: -80, exit_date: "2026-08-02T12:00:00.000Z" }),
      trade({ id: "3", pnl: -40, exit_date: "2026-08-03T12:00:00.000Z" }),
      trade({ id: "4", pnl: 20, exit_date: "2026-08-04T12:00:00.000Z" }),
    ];

    // Start 0: peak 100 → trough -20 → DD = -120
    const stats = computeJournalStats(trades, [], 0);
    expect(stats.maxDrawdown).toBeCloseTo(-120, 5);
    expect(stats.maxConsecutiveLosses).toBe(2);
    expect(stats.maxConsecutiveWins).toBe(1);
  });

  it("does not blend calculator results when omitted", () => {
    const trades = [trade({ id: "1", pnl: 10 })];
    const stats = computeJournalStats(trades);
    expect(stats.closedTrades).toBe(1);
    expect(stats.totalPnl).toBe(10);
  });
});

describe("strategy / session / instrument rollups", () => {
  it("resolveStrategyKey normalizes tags and untagged", () => {
    expect(resolveStrategyKey(null)).toBe("Untagged");
    expect(resolveStrategyKey("  London Breakout  ")).toBe("London Breakout");
  });

  it("classifies forex sessions by UTC hour", () => {
    expect(classifyTradingSession(new Date("2026-08-03T02:00:00.000Z"))).toBe("asian");
    expect(classifyTradingSession(new Date("2026-08-03T09:00:00.000Z"))).toBe("london");
    expect(classifyTradingSession(new Date("2026-08-03T14:00:00.000Z"))).toBe("london_ny");
    expect(classifyTradingSession(new Date("2026-08-03T18:00:00.000Z"))).toBe("new_york");
    expect(classifyTradingSession(new Date("2026-08-03T22:30:00.000Z"))).toBe("off_hours");
  });

  it("aggregates strategy / instrument / session P&L against a fixture set", () => {
    const trades = [
      trade({
        id: "1",
        pnl: 100,
        tags: "Breakout",
        pair: "EUR/USD",
        exit_date: "2026-08-03T09:00:00.000Z", // London
      }),
      trade({
        id: "2",
        pnl: -40,
        tags: "Breakout",
        pair: "EUR/USD",
        exit_date: "2026-08-03T10:00:00.000Z", // London
      }),
      trade({
        id: "3",
        pnl: 50,
        tags: "Mean Reversion",
        pair: "GBP/USD",
        exit_date: "2026-08-03T18:00:00.000Z", // NY
      }),
      trade({
        id: "4",
        pnl: 20,
        tags: null,
        pair: "XAU/USD",
        exit_date: "2026-08-03T03:00:00.000Z", // Asian
      }),
      trade({
        id: "5",
        pnl: null,
        status: "open",
        tags: "Breakout",
        pair: "EUR/USD",
        exit_date: null,
      }),
    ];

    const byStrategy = computeStrategyBreakdown(trades);
    const breakout = byStrategy.find((row) => row.key === "breakout");
    const meanRev = byStrategy.find((row) => row.key === "mean reversion");
    const untagged = byStrategy.find((row) => row.key === "untagged");

    expect(breakout).toMatchObject({ trades: 2, wins: 1, losses: 1, pnl: 60 });
    expect(breakout?.winRate).toBeCloseTo(50, 5);
    expect(breakout?.expectancy).toBeCloseTo(30, 5);
    expect(meanRev).toMatchObject({ trades: 1, wins: 1, pnl: 50 });
    expect(untagged).toMatchObject({ trades: 1, wins: 1, pnl: 20 });

    const byInstrument = computeInstrumentBreakdown(trades);
    expect(byInstrument.find((row) => row.key === "EUR/USD")).toMatchObject({
      trades: 2,
      pnl: 60,
    });
    expect(byInstrument.find((row) => row.key === "GBP/USD")).toMatchObject({
      trades: 1,
      pnl: 50,
    });
    expect(byInstrument.find((row) => row.key === "XAU/USD")).toMatchObject({
      trades: 1,
      pnl: 20,
    });

    const bySession = computeSessionBreakdown(trades);
    expect(bySession.find((row) => row.key === "london")).toMatchObject({
      trades: 2,
      pnl: 60,
      wins: 1,
      losses: 1,
    });
    expect(bySession.find((row) => row.key === "new_york")).toMatchObject({
      trades: 1,
      pnl: 50,
    });
    expect(bySession.find((row) => row.key === "asian")).toMatchObject({
      trades: 1,
      pnl: 20,
    });
    expect(bySession.find((row) => row.key === "london_ny")?.trades).toBe(0);
    expect(bySession.find((row) => row.key === "off_hours")?.trades).toBe(0);
  });

  it("returns empty strategy/instrument lists when no closed P&L", () => {
    expect(computeStrategyBreakdown([])).toEqual([]);
    expect(computeInstrumentBreakdown([])).toEqual([]);
    expect(computeSessionBreakdown([]).every((row) => row.trades === 0)).toBe(true);
  });

  it("toDateKeyInTimeZone formats in IANA zone", () => {
    // 2026-08-03 02:00 UTC → still Aug 2 evening in America/Los_Angeles (UTC-7 in Aug)
    const date = new Date("2026-08-03T02:00:00.000Z");
    expect(toDateKeyInTimeZone(date, "UTC")).toBe("2026-08-03");
    expect(toDateKeyInTimeZone(date, "America/Los_Angeles")).toBe("2026-08-02");
  });
});
