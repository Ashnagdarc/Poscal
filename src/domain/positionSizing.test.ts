import { describe, expect, it } from "vitest";

import { findBrokerProfile, resolveInstrumentForBroker } from "@/domain/brokers";
import { calculatePositionSize, calculatePipValueInAccountCurrency } from "@/domain/positionSizing";

describe("position sizing domain", () => {
  it("sizes a EUR/USD limit order without any live quote dependency", () => {
    const broker = findBrokerProfile("generic-forex")!;
    const instrument = resolveInstrumentForBroker(broker, "EUR/USD");

    const result = calculatePositionSize({
      broker,
      instrument,
      accountBalance: 10000,
      riskPercent: 1,
      entryPrice: 1.1,
      stopLossPrice: 1.095,
      takeProfitPrice: 1.11,
      side: "buy",
      orderType: "limit",
    });

    expect(result.stopDistancePips).toBeCloseTo(50, 6);
    expect(result.pipValueInAccountCurrency).toBeCloseTo(10, 6);
    expect(result.lots).toBeCloseTo(0.2, 6);
    expect(result.actualRiskAmount).toBeCloseTo(100, 6);
  });

  it("uses ask price for market buys", () => {
    const broker = findBrokerProfile("generic-forex")!;
    const instrument = resolveInstrumentForBroker(broker, "EUR/USD");

    const result = calculatePositionSize({
      broker,
      instrument,
      accountBalance: 10000,
      riskPercent: 1,
      stopLossPrice: 1.095,
      takeProfitPrice: 1.11,
      side: "buy",
      orderType: "market",
      marketQuote: { bid: 1.0998, ask: 1.1, mid: 1.0999 },
    });

    expect(result.entryPrice).toBe(1.1);
  });

  it("uses bid price for market sells", () => {
    const broker = findBrokerProfile("generic-forex")!;
    const instrument = resolveInstrumentForBroker(broker, "EUR/USD");

    const result = calculatePositionSize({
      broker,
      instrument,
      accountBalance: 10000,
      riskPercent: 1,
      stopLossPrice: 1.105,
      takeProfitPrice: 1.09,
      side: "sell",
      orderType: "market",
      marketQuote: { bid: 1.1, ask: 1.1002, mid: 1.1001 },
    });

    expect(result.entryPrice).toBe(1.1);
    expect(result.stopDistancePips).toBeCloseTo(50, 6);
  });

  it("converts JPY pip value into USD using an inverse rate", () => {
    const broker = findBrokerProfile("generic-forex")!;
    const instrument = resolveInstrumentForBroker(broker, "GBP/JPY");

    const pipValue = calculatePipValueInAccountCurrency(instrument, "USD", {
      "USD/JPY": 150,
    });

    expect(pipValue).toBeCloseTo(1000 / 150, 6);
  });

  it("sizes a USD/JPY limit order from entry price without extra conversion data", () => {
    const broker = findBrokerProfile("generic-forex")!;
    const instrument = resolveInstrumentForBroker(broker, "USD/JPY");

    const result = calculatePositionSize({
      broker,
      instrument,
      accountBalance: 10000,
      riskPercent: 1,
      entryPrice: 150,
      stopLossPrice: 149.5,
      takeProfitPrice: 151,
      side: "buy",
      orderType: "limit",
    });

    expect(result.pipValueInAccountCurrency).toBeCloseTo(1000 / 150, 6);
    expect(result.stopDistancePips).toBeCloseTo(50, 6);
  });

  it("sizes a JPY cross with conversion rates", () => {
    const broker = findBrokerProfile("generic-forex")!;
    const instrument = resolveInstrumentForBroker(broker, "GBP/JPY");

    const result = calculatePositionSize({
      broker,
      instrument,
      accountBalance: 10000,
      riskPercent: 1,
      entryPrice: 195,
      stopLossPrice: 194,
      takeProfitPrice: 197,
      side: "buy",
      orderType: "limit",
      conversionRates: { "USD/JPY": 150 },
    });

    expect(result.stopDistancePips).toBeCloseTo(100, 6);
    expect(result.lots).toBeCloseTo(0.15, 6);
  });

  it("applies broker overrides for CFD indices", () => {
    const broker = findBrokerProfile("generic-cfd")!;
    const instrument = resolveInstrumentForBroker(broker, "US30/USD");

    expect(instrument.minLot).toBe(1);
    expect(instrument.lotStep).toBe(1);
  });

  it("returns zero size when raw lots fall below broker minimum", () => {
    const broker = findBrokerProfile("generic-cfd")!;
    const instrument = resolveInstrumentForBroker(broker, "XAU/USD");

    const result = calculatePositionSize({
      broker,
      instrument,
      accountBalance: 1000,
      riskPercent: 0.25,
      entryPrice: 2400,
      stopLossPrice: 2390,
      takeProfitPrice: 2420,
      side: "buy",
      orderType: "limit",
    });

    expect(result.rawLots).toBeGreaterThan(0);
    expect(result.lots).toBe(0);
    expect(result.isBelowMinimumLot).toBe(true);
  });

  it("throws when a cross-currency conversion rate is missing", () => {
    const broker = findBrokerProfile("generic-forex")!;
    const instrument = resolveInstrumentForBroker(broker, "EUR/GBP");

    expect(() =>
      calculatePositionSize({
        broker,
        instrument,
        accountBalance: 10000,
        riskPercent: 1,
        entryPrice: 0.85,
        stopLossPrice: 0.84,
        takeProfitPrice: 0.87,
        side: "buy",
        orderType: "limit",
      }),
    ).toThrow("Missing conversion rate");
  });
});
