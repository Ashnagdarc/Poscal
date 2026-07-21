import { describe, expect, it } from "vitest";
import { INSTRUMENT_SPECS } from "@/lib/instrumentSpecs";
import { calculatePositionSize } from "@/lib/positionSizeCalculator";
import { pipsToPrices, pricesToPips } from "@/lib/calculatorModeSync";

type Sample = { entry: number; slPips: number; tpPips: number };

const SAMPLES: Record<string, Sample> = {
  "EUR/USD": { entry: 1.085, slPips: 25, tpPips: 50 },
  "GBP/USD": { entry: 1.265, slPips: 30, tpPips: 60 },
  "USD/JPY": { entry: 150.25, slPips: 20, tpPips: 40 },
  "USD/CHF": { entry: 0.885, slPips: 25, tpPips: 50 },
  "AUD/USD": { entry: 0.655, slPips: 20, tpPips: 40 },
  "USD/CAD": { entry: 1.355, slPips: 25, tpPips: 50 },
  "NZD/USD": { entry: 0.605, slPips: 22, tpPips: 44 },
  "XAU/USD": { entry: 2650.5, slPips: 15, tpPips: 30 },
  "XAG/USD": { entry: 30.125, slPips: 50, tpPips: 100 },
  "BTC/USD": { entry: 95000, slPips: 500, tpPips: 1000 },
  "ETH/USD": { entry: 3500.5, slPips: 50, tpPips: 100 },
  US30: { entry: 42000, slPips: 100, tpPips: 200 },
  US100: { entry: 18500, slPips: 50, tpPips: 100 },
  US500: { entry: 5800, slPips: 25, tpPips: 50 },
};

const BALANCES = [500, 9651.28, 50000];
const RISK_PERCENTS = [0.5, 1, 2, 3];

describe("instrument pips vs price parity", () => {
  for (const symbol of Object.keys(INSTRUMENT_SPECS)) {
    const sample = SAMPLES[symbol];
    if (!sample) continue;

    it(`${symbol}: pips and price modes produce the same lot size`, () => {
      const spec = INSTRUMENT_SPECS[symbol];
      const prices = pipsToPrices({
        spec,
        direction: "buy",
        entryPrice: sample.entry,
        stopLossPips: sample.slPips,
        takeProfitPips: sample.tpPips,
      });

      const stopLossPrice = parseFloat(prices.stopLossPrice);
      const takeProfitPrice = parseFloat(prices.takeProfitPrice);

      for (const balance of BALANCES) {
        for (const riskPercent of RISK_PERCENTS) {
          const fromPips = calculatePositionSize({
            symbol,
            accountBalance: balance,
            riskPercent,
            stopLossPips: sample.slPips,
            takeProfitPips: sample.tpPips,
            entryPrice: sample.entry,
          });
          const fromPrices = calculatePositionSize({
            symbol,
            accountBalance: balance,
            riskPercent,
            entryPrice: sample.entry,
            stopLossPrice,
            takeProfitPrice,
          });

          expect(fromPips.isValid).toBe(true);
          expect(fromPrices.isValid).toBe(true);
          expect(fromPips.positionSize).toBe(fromPrices.positionSize);
          expect(fromPips.rewardToRisk).toBeCloseTo(fromPrices.rewardToRisk, 4);
        }
      }
    });

    it(`${symbol}: round-trip pip conversion stays consistent`, () => {
      const spec = INSTRUMENT_SPECS[symbol];
      const prices = pipsToPrices({
        spec,
        direction: "buy",
        entryPrice: sample.entry,
        stopLossPips: sample.slPips,
        takeProfitPips: sample.tpPips,
      });

      const converted = pricesToPips({
        spec,
        entryPrice: sample.entry,
        stopLossPrice: parseFloat(prices.stopLossPrice),
        takeProfitPrice: parseFloat(prices.takeProfitPrice),
      });

      expect(converted.stopLossPips).toBeCloseTo(sample.slPips, 0);
      expect(converted.takeProfitPips).toBeCloseTo(sample.tpPips, 0);
    });
  }
});
