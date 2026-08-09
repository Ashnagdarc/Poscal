import { describe, expect, it } from "vitest";
import type { JournalTrade } from "@/lib/convexJournal";
import { buildExportFilename, tradesToCsv } from "./exportJournalCsv";

const sampleTrade = (overrides: Partial<JournalTrade> = {}): JournalTrade => ({
  id: "t1",
  pair: "EUR/USD",
  direction: "buy",
  entry_price: 1.1,
  exit_price: 1.12,
  stop_loss: 1.09,
  take_profit: 1.13,
  position_size: 0.5,
  risk_percent: 1,
  risk_amount: 100,
  pnl: 200,
  pnl_percent: 2,
  status: "closed",
  notes: 'Hit TP, "nice"',
  entry_date: "2026-08-01T12:00:00.000Z",
  exit_date: "2026-08-01T14:00:00.000Z",
  created_at: "2026-08-01T12:00:00.000Z",
  tags: "Breakout",
  market_condition: "trending",
  ...overrides,
});

describe("exportJournalCsv", () => {
  it("maps buy/sell to long/short and escapes notes", () => {
    const csv = tradesToCsv([sampleTrade()]);
    expect(csv.split("\n")[0]).toContain("pair,direction");
    expect(csv).toContain("EUR/USD,long,");
    expect(csv).toContain('"Hit TP, ""nice"""');
  });

  it("keeps long/short directions", () => {
    const csv = tradesToCsv([sampleTrade({ direction: "short" })]);
    expect(csv).toContain(",short,");
  });

  it("builds a dated filename", () => {
    const localNoon = new Date(2026, 7, 10, 12, 0, 0); // Aug 10 local
    expect(buildExportFilename(localNoon)).toBe("poscal-trades-2026-08-10.csv");
  });
});
