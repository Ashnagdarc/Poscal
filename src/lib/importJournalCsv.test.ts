import { describe, expect, it } from "vitest";
import { parseAndValidateJournalCsv, splitCsvLine } from "./importJournalCsv";

describe("importJournalCsv", () => {
  it("splits quoted CSV cells", () => {
    expect(splitCsvLine('EUR/USD,long,"note, with comma",closed')).toEqual([
      "EUR/USD",
      "long",
      "note, with comma",
      "closed",
    ]);
  });

  it("parses Poscal export headers and maps buy→long", () => {
    const csv = [
      "pair,direction,entry_price,exit_price,stop_loss,take_profit,position_size,risk_percent,risk_amount,pnl,pnl_percent,status,notes,tags,market_condition,entry_date,exit_date,created_at",
      "EUR/USD,buy,1.1,1.2,1.05,1.25,0.5,1,,50,,closed,hello,,,,2026-01-01T00:00:00.000Z,2026-01-02T00:00:00.000Z,2026-01-01T00:00:00.000Z",
    ].join("\n");

    const result = parseAndValidateJournalCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.validTrades).toHaveLength(1);
    expect(result.validTrades[0]).toMatchObject({
      pair: "EUR/USD",
      direction: "long",
      entry_price: 1.1,
      status: "closed",
      notes: "hello",
    });
  });

  it("rejects files without required columns", () => {
    const result = parseAndValidateJournalCsv("foo,bar\n1,2\n");
    expect(result.validTrades).toHaveLength(0);
    expect(result.errors[0]).toMatch(/pair and direction/i);
  });
});
