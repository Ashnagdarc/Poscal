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
      accountBalance: 1000,
      riskPercent: 1,
      stopLossPips: 20,
    });

    expect(result.isValid).toBe(true);
    expect(result.positionSize).toBe(0.05);
    expect(result.warning).toContain("Broker");
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

  it("rounds lot size down to lot step", () => {
    expect(roundToLotStep(0.057, 0.01)).toBe(0.05);
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
});

