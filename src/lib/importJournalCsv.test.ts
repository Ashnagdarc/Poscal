import { describe, expect, it } from "vitest";
import {
  parseAndValidateJournalCsv,
  parseAndValidateJournalImport,
  splitCsvLine,
} from "./importJournalCsv";

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
    expect(result.errors[0]).toMatch(/trade columns/i);
  });

  it("auto-detects an MT5 position-history CSV", () => {
    const csv = [
      "Open Time,Position,Symbol,Type,Volume,Open Price,S / L,T / P,Close Time,Close Price,Commission,Swap,Profit,Comment",
      "2026.10.01 09:15:30,1001,EURUSD,buy,0.20,1.17000,1.16500,1.18000,2026.10.01 11:45:00,1.17600,-1.40,-0.25,120.00,London breakout",
      "2026.10.02 14:00:00,1002,GBPUSD,sell,0.10,1.34000,1.34500,1.33000,2026.10.02 16:30:00,1.33500,-0.70,0,50.00,",
      ",,balance,deposit,,,,,,,,,1000.00,",
    ].join("\n");

    const result = parseAndValidateJournalImport(csv, {
      fileName: "mt5-history.csv",
    });

    expect(result.source).toBe("mt5");
    expect(result.errors).toEqual([]);
    expect(result.validTrades).toHaveLength(2);
    expect(result.validTrades[0]).toMatchObject({
      pair: "EURUSD",
      direction: "long",
      entry_price: 1.17,
      exit_price: 1.176,
      position_size: 0.2,
      pnl: 118.35,
      status: "closed",
      notes: "London breakout",
      entry_date: "2026-10-01T09:15:30",
      exit_date: "2026-10-01T11:45:00",
      tags: "MT5",
    });
  });

  it("pairs MT5 entry and exit deals by position ID", () => {
    const tsv = [
      "Time\tDeal\tPosition ID\tSymbol\tType\tEntry\tVolume\tPrice\tS/L\tT/P\tCommission\tFee\tSwap\tProfit\tComment",
      "2026.10.03 08:00:00\t501\t9001\tXAUUSD\tbuy\tin\t0.10\t2650.00\t2640.00\t2670.00\t-0.50\t0\t0\t0\tentry",
      "2026.10.03 10:15:00\t502\t9001\tXAUUSD\tsell\tout\t0.10\t2665.00\t2640.00\t2670.00\t-0.50\t0\t-0.20\t150.00\texit",
    ].join("\n");

    const result = parseAndValidateJournalImport(tsv, {
      fileName: "deals.tsv",
    });

    expect(result.source).toBe("mt5");
    expect(result.errors).toEqual([]);
    expect(result.validTrades).toHaveLength(1);
    expect(result.validTrades[0]).toMatchObject({
      pair: "XAUUSD",
      direction: "long",
      entry_price: 2650,
      exit_price: 2665,
      position_size: 0.1,
      pnl: 148.8,
      status: "closed",
      notes: "entry · exit",
    });
  });

  it("matches an MT5 report's in/out deals when position IDs are omitted", () => {
    const csv = [
      "Time,Deal,Symbol,Type,Direction,Volume,Price,Commission,Swap,Profit,Comment",
      "2026.10.03 08:00:00,501,EURUSD,buy,in,0.10,1.17000,-0.40,0,0,entry",
      "2026.10.03 10:15:00,502,EURUSD,sell,out,0.10,1.17500,-0.40,-0.10,50.00,exit",
    ].join("\n");

    const result = parseAndValidateJournalImport(csv, {
      fileName: "report.csv",
    });

    expect(result.errors).toEqual([]);
    expect(result.validTrades).toHaveLength(1);
    expect(result.validTrades[0]).toMatchObject({
      pair: "EURUSD",
      direction: "long",
      entry_price: 1.17,
      exit_price: 1.175,
      pnl: 49.1,
      status: "closed",
    });
  });

  it("reads semicolon-delimited MT5 exports with decimal commas", () => {
    const csv = [
      "Open Time;Symbol;Type;Volume;Open Price;Close Time;Close Price;Profit",
      "2026.10.04 09:00:00;EURUSD;buy;0,10;1,17000;2026.10.04 10:00:00;1,17500;50,25",
    ].join("\n");

    const result = parseAndValidateJournalImport(csv, {
      fileName: "history.csv",
    });

    expect(result.errors).toEqual([]);
    expect(result.validTrades[0]).toMatchObject({
      pair: "EURUSD",
      position_size: 0.1,
      entry_price: 1.17,
      pnl: 50.25,
    });
  });

  it("finds the trade table in an MT5 HTML report", () => {
    const html = `
      <html><body>
        <table><tr><th>Metric</th><th>Value</th></tr></table>
        <table>
          <tr><th>Open Time</th><th>Symbol</th><th>Type</th><th>Volume</th><th>Open Price</th><th>Close Time</th><th>Close Price</th><th>Profit</th></tr>
          <tr><td>2026.10.05 07:00:00</td><td>USDJPY</td><td>sell</td><td>0.30</td><td>150.10</td><td>2026.10.05 08:00:00</td><td>149.90</td><td>60.00</td></tr>
        </table>
      </body></html>`;

    const result = parseAndValidateJournalImport(html, {
      fileName: "report.html",
    });

    expect(result.errors).toEqual([]);
    expect(result.validTrades[0]).toMatchObject({
      pair: "USDJPY",
      direction: "short",
      pnl: 60,
      status: "closed",
    });
  });
});
