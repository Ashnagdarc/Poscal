import { describe, expect, it } from "vitest";

import { INSTRUMENT_SPECS, resolveInstrumentSymbol } from "@/lib/instrumentSpecs";
import {
  calculatePositionSize,
  roundToLotStep,
  resolveEffectivePipValue,
  requiresEntryForPipValue,
  isCrossPair,
  requiredConversionPair,
} from "@/lib/positionSizeCalculator";

/** Independent lot formula matching the calculator (floor-to-step, then clamp). */
function expectedPositionSize(input: {
  riskAmount: number;
  stopLossPips: number;
  pipValue: number;
  lotStep: number;
  minLot: number;
  maxLot: number;
}): number {
  const rawLotSize = input.riskAmount / (input.stopLossPips * input.pipValue);
  const rounded = roundToLotStep(rawLotSize, input.lotStep);
  const wasMinLotClamped = rounded > 0 && rounded < input.minLot;
  const wasMaxLotClamped = rounded > input.maxLot;
  return Math.min(Math.max(rounded, wasMinLotClamped ? input.minLot : 0), input.maxLot);
}

const BALANCE = 10_000;
const RISK_PERCENT = 1;
const RISK_AMOUNT = 100;

/** Representative mid prices / conversion rates for instruments that need them. */
const ENTRY_BY_SYMBOL: Record<string, number> = {
  "USD/JPY": 150,
  "USD/CHF": 0.885,
  "USD/CAD": 1.355,
  "EUR/JPY": 162.5,
  "GBP/JPY": 190,
};

const MARKET_PRICES = {
  "GBP/USD": 1.27,
  "USD/JPY": 150,
};

const STOP_BY_ASSET: Record<string, number> = {
  forex: 25,
  metal: 10,
  crypto: 100,
  index: 50,
  commodity: 20,
};

describe("all instrument lot-size calculations", () => {
  const symbols = Object.keys(INSTRUMENT_SPECS);

  it("registers every featured pair the product lists", () => {
    const expected = [
      "EUR/USD",
      "GBP/USD",
      "USD/JPY",
      "USD/CHF",
      "AUD/USD",
      "USD/CAD",
      "NZD/USD",
      "EUR/GBP",
      "EUR/JPY",
      "GBP/JPY",
      "BTC/USD",
      "ETH/USD",
      "SOL/USD",
      "XRP/USD",
      "ADA/USD",
      "XAU/USD",
      "XAG/USD",
      "XPT/USD",
      "XCU/USD",
      "US500",
      "US100",
      "US30",
      "DE40",
      "UK100",
      "JP225",
      "WTI/USD",
      "BRENT/USD",
      "NATGAS/USD",
      "SOYBEAN/USD",
      "IRON/USD",
    ];

    for (const symbol of expected) {
      expect(INSTRUMENT_SPECS[symbol], `missing spec for ${symbol}`).toBeDefined();
    }
  });

  for (const symbol of symbols) {
    it(`${symbol}: lot size matches risk / (SL × pipValue) with lot-step rounding`, () => {
      const spec = INSTRUMENT_SPECS[symbol];
      const stopLossPips = STOP_BY_ASSET[spec.assetClass] ?? 25;
      const entryPrice = ENTRY_BY_SYMBOL[symbol];
      const marketPrices = isCrossPair(symbol) ? MARKET_PRICES : undefined;

      if (requiresEntryForPipValue(symbol) && entryPrice == null) {
        throw new Error(`Missing ENTRY_BY_SYMBOL for USD-base pair ${symbol}`);
      }

      const pipValue = resolveEffectivePipValue(spec, symbol, entryPrice, marketPrices);
      expect(pipValue).toBeTruthy();
      expect(pipValue!).toBeGreaterThan(0);

      const result = calculatePositionSize({
        symbol,
        accountBalance: BALANCE,
        riskPercent: RISK_PERCENT,
        stopLossPips,
        entryPrice,
        marketPrices,
      });

      const expected = expectedPositionSize({
        riskAmount: RISK_AMOUNT,
        stopLossPips,
        pipValue: pipValue!,
        lotStep: spec.lotStep,
        minLot: spec.minLot,
        maxLot: spec.maxLot,
      });

      expect(result.isValid).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(result.pipValue).toBeCloseTo(pipValue!, 6);
      expect(result.positionSize).toBe(expected);
      expect(result.units).toBeCloseTo(expected * spec.contractSize, 8);
      // Actual risk should track sized lots × SL × pip (may exceed target when min-lot clamped)
      expect(result.actualRisk).toBeCloseTo(
        result.positionSize * stopLossPips * pipValue!,
        6,
      );
    });
  }

  it("resolves common aliases to canonical specs", () => {
    expect(resolveInstrumentSymbol("DAX")).toBe("DE40");
    expect(resolveInstrumentSymbol("SPX500")).toBe("US500");
    expect(resolveInstrumentSymbol("NDX100")).toBe("US100");
    expect(resolveInstrumentSymbol("DJI")).toBe("US30");
    expect(resolveInstrumentSymbol("NIKKEI")).toBe("JP225");
    expect(resolveInstrumentSymbol("BCO/USD")).toBe("BRENT/USD");
    expect(resolveInstrumentSymbol("CL/USD")).toBe("WTI/USD");
    expect(resolveInstrumentSymbol("NG/USD")).toBe("NATGAS/USD");
    expect(resolveInstrumentSymbol("COPPER/USD")).toBe("XCU/USD");

    const viaAlias = calculatePositionSize({
      symbol: "DAX",
      accountBalance: BALANCE,
      riskPercent: RISK_PERCENT,
      stopLossPips: 50,
    });
    const viaCanonical = calculatePositionSize({
      symbol: "DE40",
      accountBalance: BALANCE,
      riskPercent: RISK_PERCENT,
      stopLossPips: 50,
    });

    expect(viaAlias.isValid).toBe(true);
    expect(viaAlias.symbol).toBe("DE40");
    expect(viaAlias.positionSize).toBe(viaCanonical.positionSize);
  });
});

describe("known reference lot sizes for new instruments", () => {
  it.each([
    // Crypto: $1/pt → lots = 100 / (100 * 1) = 1
    { symbol: "SOL/USD", stop: 100, expectedLots: 1 },
    { symbol: "XRP/USD", stop: 100, expectedLots: 1 },
    { symbol: "ADA/USD", stop: 100, expectedLots: 1 },
    // Platinum: $50/pt → 100 / (10 * 50) = 0.2
    { symbol: "XPT/USD", stop: 10, expectedLots: 0.2 },
    // Copper: $25/0.01 → 100 / (20 * 25) = 0.2
    { symbol: "XCU/USD", stop: 20, expectedLots: 0.2 },
    // Indices: $1/pt → 100 / (50 * 1) = 2
    { symbol: "DE40", stop: 50, expectedLots: 2 },
    { symbol: "UK100", stop: 50, expectedLots: 2 },
    { symbol: "JP225", stop: 50, expectedLots: 2 },
    // Oil CFD: $1 per 0.01 → 100 / (20 * 1) = 5
    { symbol: "WTI/USD", stop: 20, expectedLots: 5 },
    { symbol: "BRENT/USD", stop: 20, expectedLots: 5 },
    // Nat gas: $10 per 0.001 → 100 / (20 * 10) = 0.5
    { symbol: "NATGAS/USD", stop: 20, expectedLots: 0.5 },
    // Soybean: $12.5 per 0.25 → 100 / (20 * 12.5) = 0.4
    { symbol: "SOYBEAN/USD", stop: 20, expectedLots: 0.4 },
    // Iron: $1 per 0.01 → 100 / (20 * 1) = 5
    { symbol: "IRON/USD", stop: 20, expectedLots: 5 },
  ])("$symbol @ $stop pts → $expectedLots lots", ({ symbol, stop, expectedLots }) => {
    const result = calculatePositionSize({
      symbol,
      accountBalance: BALANCE,
      riskPercent: RISK_PERCENT,
      stopLossPips: stop,
    });

    expect(result.isValid).toBe(true);
    expect(result.positionSize).toBe(expectedLots);
  });

  it("GBP/JPY sizes with USD/JPY conversion", () => {
    // pip in JPY = 1000; USD pip = 1000/150; lots = 100 / (30 * 6.666…) = 0.5
    const result = calculatePositionSize({
      symbol: "GBP/JPY",
      accountBalance: BALANCE,
      riskPercent: RISK_PERCENT,
      stopLossPips: 30,
      marketPrices: { "USD/JPY": 150 },
    });

    expect(result.isValid).toBe(true);
    expect(result.pipValue).toBeCloseTo(1000 / 150, 4);
    expect(result.positionSize).toBe(0.5);
    expect(requiredConversionPair("GBP/JPY")).toBe("USD/JPY");
  });
});
