import { describe, expect, it } from "vitest";
import { INSTRUMENT_SPECS } from "@/lib/instrumentSpecs";
import { calculatePositionSize } from "@/lib/positionSizeCalculator";
import {
  calculatePositionFromRisk,
  priceDistanceFromPips,
  resolvePipValueUsd,
  resolveTickValueUsd,
} from "@/lib/trading/engine";
import { resolveInstrumentSpec } from "@/lib/trading/instrumentResolver";

describe("tick-based trading engine", () => {
  it("models XAU/USD pips separately from broker ticks", () => {
    const spec = INSTRUMENT_SPECS["XAU/USD"];
    expect(spec.pipSize).toBe(0.1);
    expect(spec.tickSize).toBe(0.01);
    expect(spec.tickValueInProfitCurrency).toBe(1);

    const tick = resolveTickValueUsd(spec);
    expect(tick?.tickValueUsd).toBe(1);
    expect(resolvePipValueUsd(spec)).toBe(10);
  });

  it("sizes the reported gold case from price distance and ticks", () => {
    const spec = INSTRUMENT_SPECS["XAU/USD"];
    const distance = priceDistanceFromPips(112.2, spec);
    const result = calculatePositionFromRisk({
      spec,
      riskAmountUsd: 900,
      priceDistance: distance,
    });

    expect(distance).toBeCloseTo(11.22, 8);
    expect(result.isValid).toBe(true);
    if (!result.isValid) return;
    expect(result.ticksToStop).toBeCloseTo(1122, 8);
    expect(result.tickValueUsd).toBe(1);
    expect(result.lossPerLotUsd).toBeCloseTo(1122, 8);
    expect(result.positionSize).toBe(0.8);
    expect(result.actualRiskUsd).toBeCloseTo(897.6, 8);
  });

  it("supports a broker override without changing calculator code", () => {
    const result = calculatePositionSize({
      symbol: "US30",
      accountBalance: 10000,
      riskPercent: 1,
      stopLossPips: 50,
      instrumentSpecOverride: {
        source: "broker",
        tickSize: 1,
        tickValueInProfitCurrency: 5,
        contractSize: 5,
        pipSize: 1,
        minLot: 0.01,
        maxLot: 100,
        lotStep: 0.01,
        baseCurrency: "US30",
        quoteCurrency: "USD",
        profitCurrency: "USD",
      },
    });

    expect(result.isValid).toBe(true);
    expect(result.spec?.source).toBe("broker");
    expect(result.tickValue).toBe(5);
    expect(result.positionSize).toBe(0.4);
  });

  it("recomputes native tick economics for partial contract overrides", () => {
    const spec = resolveInstrumentSpec("XAU/USD", {
      source: "custom",
      contractSize: 10,
      tickSize: 0.01,
    });

    expect(spec).toBeDefined();
    expect(spec?.tickValueInProfitCurrency).toBeCloseTo(0.1, 8);
  });

  it("keeps every fallback contract internally coherent", () => {
    for (const spec of Object.values(INSTRUMENT_SPECS)) {
      expect(spec.tickSize).toBeGreaterThan(0);
      expect(spec.tickValueInProfitCurrency).toBeGreaterThan(0);
      expect(spec.contractSize).toBeGreaterThan(0);
      expect(spec.tickValueInProfitCurrency).toBeCloseTo(
        spec.contractSize * spec.tickSize,
        8,
      );
    }
  });
});
