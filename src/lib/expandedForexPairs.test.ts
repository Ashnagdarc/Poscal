import { describe, expect, it } from "vitest";

import { COMMON_PAIRS } from "@/lib/constants";
import { INSTRUMENT_SPECS } from "@/lib/instrumentSpecs";
import {
  calculatePositionSize,
  requiredConversionPair,
} from "@/lib/positionSizeCalculator";
import {
  SUPPORTED_PAIR_SUGGESTIONS,
  validateTradePairInput,
} from "@/lib/supportedPairs";
import { FOREX_SYMBOLS } from "../../shared/instrumentCatalog";
import { assertValidTradeFields } from "../../convex/lib/tradeValidation";

const ADDED_FX_PAIRS = [
  "AUD/CAD",
  "AUD/CHF",
  "AUD/JPY",
  "AUD/NZD",
  "CAD/CHF",
  "CAD/JPY",
  "CHF/JPY",
  "EUR/AUD",
  "EUR/CAD",
  "EUR/CHF",
  "EUR/NZD",
  "GBP/AUD",
  "GBP/CAD",
  "GBP/CHF",
  "GBP/NZD",
  "NZD/CAD",
  "NZD/CHF",
  "NZD/JPY",
] as const;

const USD_CONVERSION_PRICES: Record<string, number> = {
  "EUR/USD": 1.1,
  "GBP/USD": 1.25,
  "AUD/USD": 0.65,
  "NZD/USD": 0.6,
  "USD/CAD": 1.35,
  "USD/CHF": 0.9,
  "USD/JPY": 150,
};

const SAMPLE_ENTRY: Record<(typeof ADDED_FX_PAIRS)[number], number> = {
  "AUD/CAD": 0.9,
  "AUD/CHF": 0.58,
  "AUD/JPY": 97.5,
  "AUD/NZD": 1.08,
  "CAD/CHF": 0.66,
  "CAD/JPY": 108.5,
  "CHF/JPY": 164,
  "EUR/AUD": 1.67,
  "EUR/CAD": 1.48,
  "EUR/CHF": 0.96,
  "EUR/NZD": 1.8,
  "GBP/AUD": 1.92,
  "GBP/CAD": 1.72,
  "GBP/CHF": 1.11,
  "GBP/NZD": 2.07,
  "NZD/CAD": 0.83,
  "NZD/CHF": 0.54,
  "NZD/JPY": 90,
};

function quoteToUsdRate(quote: string): number {
  if (quote === "USD") return 1;
  const direct = USD_CONVERSION_PRICES[`${quote}/USD`];
  if (direct) return direct;
  const inverse = USD_CONVERSION_PRICES[`USD/${quote}`];
  if (inverse) return 1 / inverse;
  throw new Error(`Missing independent USD conversion fixture for ${quote}`);
}

function floorLots(raw: number): number {
  return Math.floor((raw + Number.EPSILON) / 0.01) * 0.01;
}

describe("expanded 28-pair FX catalogue", () => {
  it("contains the complete 28-pair major/minor FX matrix", () => {
    expect(FOREX_SYMBOLS).toHaveLength(28);
    for (const symbol of ADDED_FX_PAIRS) {
      expect(FOREX_SYMBOLS).toContain(symbol);
    }
  });

  it.each(ADDED_FX_PAIRS)("%s is available in calculator, Add Trade, and server validation", (symbol) => {
    expect(INSTRUMENT_SPECS[symbol]).toBeDefined();
    expect(COMMON_PAIRS).toContain(symbol);
    expect(SUPPORTED_PAIR_SUGGESTIONS).toContain(symbol);
    expect(validateTradePairInput(symbol)).toEqual({
      ok: true,
      token: symbol.replace("/", ""),
    });
    expect(() => assertValidTradeFields({ pair: symbol })).not.toThrow();
  });

  it.each(ADDED_FX_PAIRS)("%s uses the standard 100k FX contract", (symbol) => {
    const spec = INSTRUMENT_SPECS[symbol]!;
    const quote = symbol.split("/")[1];
    const expectedPipSize = quote === "JPY" ? 0.01 : 0.0001;
    const expectedNativePipValue = 100_000 * expectedPipSize;

    expect(spec.assetClass).toBe("forex");
    expect(spec.contractSize).toBe(100_000);
    expect(spec.tickSize).toBe(expectedPipSize);
    expect(spec.pipSize).toBe(expectedPipSize);
    expect(spec.tickValueInProfitCurrency).toBe(expectedNativePipValue);
    expect(spec.profitCurrency).toBe(quote);
    expect(spec.minLot).toBe(0.01);
    expect(spec.lotStep).toBe(0.01);
    expect(spec.brokerSpecific).toBe(false);
  });

  it.each(ADDED_FX_PAIRS)(
    "%s sizes from quote-currency pip value converted to USD",
    (symbol) => {
      const spec = INSTRUMENT_SPECS[symbol]!;
      const quote = spec.quoteCurrency;
      const nativePipValue = 100_000 * spec.pipSize;
      const expectedPipValueUsd = nativePipValue * quoteToUsdRate(quote);
      const expectedRawLots = 100 / (25 * expectedPipValueUsd);
      const expectedLots = floorLots(expectedRawLots);

      const result = calculatePositionSize({
        symbol,
        accountBalance: 10_000,
        riskPercent: 1,
        stopLossPips: 25,
        entryPrice: SAMPLE_ENTRY[symbol],
        marketPrices: USD_CONVERSION_PRICES,
      });

      expect(result.isValid).toBe(true);
      expect(result.pipValue).toBeCloseTo(expectedPipValueUsd, 8);
      expect(result.rawLotSize).toBeCloseTo(expectedRawLots, 8);
      expect(result.positionSize).toBeCloseTo(expectedLots, 8);
      expect(result.actualRisk).toBeLessThanOrEqual(100 + 1e-8);
      expect(requiredConversionPair(symbol)).toBeTruthy();
    },
  );

  it.each(ADDED_FX_PAIRS)(
    "%s gives the same lot size from pip mode and price mode",
    (symbol) => {
      const spec = INSTRUMENT_SPECS[symbol]!;
      const entry = SAMPLE_ENTRY[symbol];
      const stopPips = 25;
      const stopLossPrice = entry - stopPips * spec.pipSize;

      const fromPips = calculatePositionSize({
        symbol,
        accountBalance: 10_000,
        riskPercent: 1,
        stopLossPips: stopPips,
        entryPrice: entry,
        marketPrices: USD_CONVERSION_PRICES,
      });
      const fromPrice = calculatePositionSize({
        symbol,
        accountBalance: 10_000,
        riskPercent: 1,
        entryPrice: entry,
        stopLossPrice,
        direction: "buy",
        marketPrices: USD_CONVERSION_PRICES,
      });

      expect(fromPips.isValid).toBe(true);
      expect(fromPrice.isValid).toBe(true);
      expect(fromPrice.positionSize).toBe(fromPips.positionSize);
      expect(fromPrice.actualRisk).toBeCloseTo(fromPips.actualRisk, 6);
    },
  );
});
