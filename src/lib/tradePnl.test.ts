import { describe, expect, it } from "vitest";

import { estimateTradePnl } from "@/lib/tradePnl";

describe("estimateTradePnl", () => {
  it("prices a USD-quote lot from the price move", () => {
    expect(
      estimateTradePnl({
        pair: "EUR/USD",
        direction: "long",
        entryPrice: 1.1,
        exitPrice: 1.101,
        lots: 1,
      }),
    ).toBe(100);
  });

  it("flips the result for a short", () => {
    expect(
      estimateTradePnl({
        pair: "EUR/USD",
        direction: "short",
        entryPrice: 1.1,
        exitPrice: 1.101,
        lots: 1,
      }),
    ).toBe(-100);
  });

  it("uses the gold contract, not a forex pip", () => {
    expect(
      estimateTradePnl({
        pair: "XAUUSD",
        direction: "long",
        entryPrice: 2650,
        exitPrice: 2655,
        lots: 0.1,
      }),
    ).toBe(50);
  });

  it("converts a USD-base pair with the entry price", () => {
    expect(
      estimateTradePnl({
        pair: "USD/JPY",
        direction: "long",
        entryPrice: 150,
        exitPrice: 150.5,
        lots: 1,
      }),
    ).toBe(333.33);
  });

  it("prices a cross only when the conversion rate is present", () => {
    const input = {
      pair: "EUR/JPY",
      direction: "long" as const,
      entryPrice: 160,
      exitPrice: 160.3,
      lots: 1,
    };

    expect(estimateTradePnl(input)).toBeNull();
    expect(estimateTradePnl({ ...input, marketPrices: { "USD/JPY": 150 } })).toBe(200);
  });

  it("converts the USD result into the account currency", () => {
    expect(
      estimateTradePnl({
        pair: "EUR/USD",
        direction: "long",
        entryPrice: 1.1,
        exitPrice: 1.101,
        lots: 1,
        accountCurrency: "GBP",
        marketPrices: { "GBP/USD": 1.25 },
      }),
    ).toBe(80);
  });

  it("returns null until exit and lots are both present", () => {
    expect(
      estimateTradePnl({
        pair: "EUR/USD",
        direction: "long",
        entryPrice: 1.1,
        exitPrice: null,
        lots: 1,
      }),
    ).toBeNull();
  });
});
