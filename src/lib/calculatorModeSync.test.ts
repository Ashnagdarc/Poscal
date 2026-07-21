import { describe, expect, it } from "vitest";
import { getInstrumentSpec } from "@/lib/positionSizeCalculator";
import { calculatePositionSize } from "@/lib/positionSizeCalculator";
import { pipsToPrices, pricesToPips } from "@/lib/calculatorModeSync";

describe("calculatorModeSync", () => {
  const eurUsd = getInstrumentSpec("EUR/USD")!;
  const xauUsd = getInstrumentSpec("XAU/USD")!;

  it("converts pips to prices for a buy trade", () => {
    const prices = pipsToPrices({
      spec: eurUsd,
      direction: "buy",
      entryPrice: 1.1,
      stopLossPips: 20,
      takeProfitPips: 40,
    });

    expect(prices.stopLossPrice).toBe("1.0980");
    expect(prices.takeProfitPrice).toBe("1.1040");
  });

  it("converts prices back to equivalent pips", () => {
    const pips = pricesToPips({
      spec: eurUsd,
      entryPrice: 1.1,
      stopLossPrice: 1.098,
      takeProfitPrice: 1.104,
    });

    expect(pips.stopLossPips).toBe(20);
    expect(pips.takeProfitPips).toBe(40);
  });

  it("produces matching lot sizes for equivalent pips and price inputs", () => {
    const fromPips = calculatePositionSize({
      symbol: "EUR/USD",
      accountBalance: 1000,
      riskPercent: 1,
      stopLossPips: 20,
    });

    const fromPrices = calculatePositionSize({
      symbol: "EUR/USD",
      accountBalance: 1000,
      riskPercent: 1,
      entryPrice: 1.1,
      stopLossPrice: 1.098,
      takeProfitPrice: 1.104,
    });

    expect(fromPips.positionSize).toBe(fromPrices.positionSize);
    expect(fromPips.stopLossPips).toBe(fromPrices.stopLossPips);
  });

  it("converts gold points to prices with two decimal places", () => {
    const prices = pipsToPrices({
      spec: xauUsd,
      direction: "buy",
      entryPrice: 4036.07,
      stopLossPips: 36,
      takeProfitPips: 32.5,
    });

    expect(prices.stopLossPrice).toBe("4000.07");
    expect(prices.takeProfitPrice).toBe("4068.57");
  });

  it("converts gold prices back to points", () => {
    const pips = pricesToPips({
      spec: xauUsd,
      entryPrice: 4036.07,
      stopLossPrice: 3999.94,
      takeProfitPrice: 4068.59,
    });

    expect(pips.stopLossPips).toBeCloseTo(36.1, 1);
    expect(pips.takeProfitPips).toBeCloseTo(32.5, 1);
  });
});
