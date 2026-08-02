import { describe, expect, it } from "vitest";

import {
  calculatePositionSize,
  getInstrumentSpec,
  roundToLotStep,
} from "@/lib/positionSizeCalculator";

describe("positionSizeCalculator", () => {
  it("calculates EUR/USD lots from pips", () => {
    const result = calculatePositionSize({
      symbol: "EUR/USD",
      accountBalance: 1000,
      riskPercent: 1,
      stopLossPips: 20,
    });

    expect(result.isValid).toBe(true);
    expect(result.positionSize).toBe(0.05);
    expect(result.riskAmount).toBe(10);
  });

  it("calculates GBP/USD lots from pips", () => {
    const result = calculatePositionSize({
      symbol: "GBP/USD",
      accountBalance: 2000,
      riskPercent: 1,
      stopLossPips: 50,
    });

    expect(result.isValid).toBe(true);
    expect(result.positionSize).toBe(0.04);
  });

  it("uses 0.01 pip size for USD/JPY", () => {
    expect(getInstrumentSpec("USD/JPY")?.pipSize).toBe(0.01);
  });

  it("calculates XAU/USD with a broker-specific local spec warning", () => {
    const result = calculatePositionSize({
      symbol: "XAU/USD",
      accountBalance: 10000,
      riskPercent: 1,
      stopLossPips: 10,
    });

    expect(result.isValid).toBe(true);
    expect(result.positionSize).toBe(0.1);
    expect(result.warning).toMatch(/Gold|point|\$1/i);
  });

  it("matches XAU/USD pips and price inputs for a ~36 point stop", () => {
    const fromPips = calculatePositionSize({
      symbol: "XAU/USD",
      accountBalance: 9651.28,
      riskPercent: 0.5,
      stopLossPips: 36,
    });

    const fromPrices = calculatePositionSize({
      symbol: "XAU/USD",
      accountBalance: 9651.28,
      riskPercent: 0.5,
      entryPrice: 4036.07,
      stopLossPrice: 3999.94,
      takeProfitPrice: 4068.59,
    });

    expect(fromPips.isValid).toBe(true);
    expect(fromPrices.isValid).toBe(true);
    expect(fromPips.positionSize).toBe(fromPrices.positionSize);
    expect(fromPips.positionSize).toBe(0.01);
    expect(fromPips.stopLossPips).toBeCloseTo(fromPrices.stopLossPips, 0);
  });

  it("returns invalid state when balance is missing", () => {
    const result = calculatePositionSize({
      symbol: "EUR/USD",
      riskPercent: 1,
      stopLossPips: 20,
    });

    expect(result.isValid).toBe(false);
    expect(result.positionSize).toBe(0);
  });

  it("returns invalid state when stop loss is missing", () => {
    const result = calculatePositionSize({
      symbol: "EUR/USD",
      accountBalance: 1000,
      riskPercent: 1,
    });

    expect(result.isValid).toBe(false);
    expect(result.positionSize).toBe(0);
  });

  it("rejects USD/JPY without entry instead of using stale static pip", () => {
    const result = calculatePositionSize({
      symbol: "USD/JPY",
      accountBalance: 10000,
      riskPercent: 1,
      stopLossPips: 20,
    });

    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/entry\/mid price/i);
  });

  it("sizes USD/JPY in pips mode when entry/mid is provided", () => {
    // pip = (100000 * 0.01) / 150 ≈ 6.6667; lots = 100 / (20 * 6.6667) ≈ 0.75 → 0.75
    const result = calculatePositionSize({
      symbol: "USD/JPY",
      accountBalance: 10000,
      riskPercent: 1,
      stopLossPips: 20,
      entryPrice: 150,
    });

    expect(result.isValid).toBe(true);
    expect(result.mode).toBe("pips");
    expect(result.pipValue).toBeCloseTo(100000 * 0.01 / 150, 6);
    expect(result.positionSize).toBe(0.75);
  });

  it("sizes USD/CHF and USD/CAD from entry in pips mode", () => {
    const chf = calculatePositionSize({
      symbol: "USD/CHF",
      accountBalance: 10000,
      riskPercent: 1,
      stopLossPips: 25,
      entryPrice: 0.885,
    });
    const cad = calculatePositionSize({
      symbol: "USD/CAD",
      accountBalance: 10000,
      riskPercent: 1,
      stopLossPips: 25,
      entryPrice: 1.355,
    });

    expect(chf.isValid).toBe(true);
    expect(chf.positionSize).toBe(0.35);
    expect(cad.isValid).toBe(true);
    expect(cad.positionSize).toBe(0.54);
  });

  it("sizes EUR/GBP with GBP/USD conversion rate", () => {
    // risk $100 / (25 pips * ($10 GBP * 1.27)) = 100 / (25 * 12.7) = 0.31
    const result = calculatePositionSize({
      symbol: "EUR/GBP",
      accountBalance: 10000,
      riskPercent: 1,
      stopLossPips: 25,
      marketPrices: { "GBP/USD": 1.27 },
    });

    expect(result.isValid).toBe(true);
    expect(result.pipValue).toBeCloseTo(12.7, 6);
    expect(result.positionSize).toBe(0.31);
  });

  it("rejects EUR/GBP without conversion rate", () => {
    const result = calculatePositionSize({
      symbol: "EUR/GBP",
      accountBalance: 10000,
      riskPercent: 1,
      stopLossPips: 25,
    });

    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/Enter GBP\/USD conversion rate/i);
  });

  it("sizes EUR/JPY with USD/JPY conversion rate", () => {
    // pip in JPY = 1000; USD pip = 1000/150 ≈ 6.6667; lots = 100/(30*6.6667) ≈ 0.5
    const result = calculatePositionSize({
      symbol: "EUR/JPY",
      accountBalance: 10000,
      riskPercent: 1,
      stopLossPips: 30,
      entryPrice: 162.5,
      marketPrices: { "USD/JPY": 150 },
    });

    expect(result.isValid).toBe(true);
    expect(result.pipValue).toBeCloseTo(1000 / 150, 4);
    expect(result.positionSize).toBe(0.5);
  });

  it("calculates stop loss distance from entry and stop-loss prices", () => {
    const result = calculatePositionSize({
      symbol: "EUR/USD",
      accountBalance: 1000,
      riskPercent: 1,
      entryPrice: 1.1,
      stopLossPrice: 1.098,
      takeProfitPrice: 1.104,
    });

    expect(result.isValid).toBe(true);
    expect(result.mode).toBe("price");
    expect(result.stopLossPips).toBeCloseTo(20, 6);
    expect(result.positionSize).toBe(0.05);
    expect(result.rewardToRisk).toBeCloseTo(2, 6);
  });

  it("sizes crosses from user-supplied marketPrices only (no live feed required)", () => {
    const withRate = calculatePositionSize({
      symbol: "GBP/JPY",
      accountBalance: 10000,
      riskPercent: 1,
      stopLossPips: 30,
      marketPrices: { "USD/JPY": 150 },
    });
    const withoutRate = calculatePositionSize({
      symbol: "GBP/JPY",
      accountBalance: 10000,
      riskPercent: 1,
      stopLossPips: 30,
    });

    expect(withRate.isValid).toBe(true);
    expect(withRate.pipValue).toBeCloseTo(1000 / 150, 4);
    expect(withoutRate.isValid).toBe(false);
    expect(withoutRate.reason).toMatch(/Enter USD\/JPY conversion rate/i);
  });
});

