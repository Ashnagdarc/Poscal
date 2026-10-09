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

    expect(prices.stopLossPrice).toBe("1.09800");
    expect(prices.takeProfitPrice).toBe("1.10400");
  });

  it("calculates fractional GBP/USD pipettes without dropping the fifth digit", () => {
    const gbpUsd = getInstrumentSpec("GBP/USD")!;
    const result = pipsToPrices({
      spec: gbpUsd,
      direction: "buy",
      entryPrice: 1.32245,
      stopLossPips: 10.5,
      takeProfitPips: 15.3,
    });
    expect(gbpUsd.pipSize).toBe(0.0001);
    expect(gbpUsd.tickSize).toBeCloseTo(0.00001, 10);
    expect(result.stopLossPrice).toBe("1.32140");
    expect(result.takeProfitPrice).toBe("1.32398");
    expect(pricesToPips({
      spec: gbpUsd,
      entryPrice: 1.32245,
      stopLossPrice: 1.3214,
      takeProfitPrice: 1.32398,
    }).stopLossPips).toBe(10.5);
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

  it("converts gold pips using the $0.10 price convention", () => {
    const prices = pipsToPrices({
      spec: xauUsd,
      direction: "buy",
      entryPrice: 4036.07,
      stopLossPips: 112.2,
      takeProfitPips: 325.2,
    });

    expect(prices.stopLossPrice).toBe("4024.85");
    expect(prices.takeProfitPrice).toBe("4068.59");
  });

  it("converts gold prices back to equivalent $0.10 pips", () => {
    const pips = pricesToPips({
      spec: xauUsd,
      entryPrice: 4036.07,
      stopLossPrice: 3999.94,
      takeProfitPrice: 4068.59,
    });

    expect(pips.stopLossPips).toBeCloseTo(361.3, 1);
    expect(pips.takeProfitPips).toBeCloseTo(325.2, 1);
  });
});
