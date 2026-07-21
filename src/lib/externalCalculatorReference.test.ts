import { describe, expect, it } from "vitest";
import { calculatePositionSize } from "@/lib/positionSizeCalculator";
import { pipsToPrices, pricesToPips } from "@/lib/calculatorModeSync";
import { getInstrumentSpecBySymbol } from "@/lib/instrumentSpecs";

/**
 * Reference values verified against Myfxbook position size calculator
 * (https://www.myfxbook.com/forex-calculators/position-size) on 2026-07-21.
 */
describe("external calculator reference checks", () => {
  it("matches Myfxbook for EUR/USD: $10k, 1%, 25 pip SL", () => {
    const result = calculatePositionSize({
      symbol: "EUR/USD",
      accountBalance: 10000,
      riskPercent: 1,
      stopLossPips: 25,
    });

    expect(result.positionSize).toBe(0.4);
    expect(result.riskAmount).toBe(100);
  });

  it("matches Myfxbook for USD/JPY when entry price is provided", () => {
    const result = calculatePositionSize({
      symbol: "USD/JPY",
      accountBalance: 10000,
      riskPercent: 1,
      stopLossPips: 20,
      entryPrice: 162.753,
    });

    // Myfxbook (2026-07-21): $100 risk, 20 pip SL, rate 162.753 -> ~0.81 lots
    expect(result.positionSize).toBe(0.81);
    expect(result.riskAmount).toBe(100);
  });

  it("XAU/USD pips and price agree for user-reported gold scenario", () => {
    const balance = 9651.28;
    const riskPercent = 0.5;
    const spec = getInstrumentSpecBySymbol("XAU/USD")!;
    const entry = 4036.07;
    const stop = 3999.94;
    const tp = 4068.59;

    const fromPips = calculatePositionSize({
      symbol: "XAU/USD",
      accountBalance: balance,
      riskPercent,
      stopLossPips: 36,
      takeProfitPips: 32.5,
    });

    const fromPrices = calculatePositionSize({
      symbol: "XAU/USD",
      accountBalance: balance,
      riskPercent,
      entryPrice: entry,
      stopLossPrice: stop,
      takeProfitPrice: tp,
    });

    expect(fromPips.positionSize).toBe(fromPrices.positionSize);
    expect(fromPips.rewardToRisk).toBeCloseTo(fromPrices.rewardToRisk, 2);

    const synced = pricesToPips({ spec, entryPrice: entry, stopLossPrice: stop, takeProfitPrice: tp });
    const prices = pipsToPrices({
      spec,
      direction: "buy",
      entryPrice: entry,
      stopLossPips: 36,
      takeProfitPips: 32.5,
    });

    expect(synced.stopLossPips).toBeCloseTo(36, 0);
    expect(parseFloat(prices.stopLossPrice)).toBeCloseTo(stop, 0);
  });

  it("USD/CHF uses entry price for pip value when available", () => {
    const result = calculatePositionSize({
      symbol: "USD/CHF",
      accountBalance: 10000,
      riskPercent: 1,
      stopLossPips: 25,
      entryPrice: 0.885,
    });

    expect(result.positionSize).toBe(0.35);
  });
});
