import { canonicalizePairSymbol } from "@/lib/pairFormat";
import {
  getInstrumentSpec,
  requiredAccountCurrencyUsdPair,
  requiredConversionPair,
  requiresEntryForPipValue,
  resolveAccountCurrencyToUsdRate,
} from "@/lib/positionSizeCalculator";
import { calculatePnlUsd } from "@/lib/trading/engine";

export interface EstimateTradePnlInput {
  pair: string;
  direction: "long" | "short";
  entryPrice: number | null;
  exitPrice: number | null;
  lots: number | null;
  accountCurrency?: string | null;
  marketPrices?: Record<string, number> | null;
}

const isPositive = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

/**
 * P&L in account currency from the same tick-based contract engine used by
 * position sizing. Returns null when prices, lots, or required FX conversion
 * are unavailable.
 */
export function estimateTradePnl(input: EstimateTradePnlInput): number | null {
  const pair = canonicalizePairSymbol(input.pair);
  const spec = getInstrumentSpec(pair);
  if (!spec) return null;
  if (!isPositive(input.entryPrice) || !isPositive(input.exitPrice) || !isPositive(input.lots)) {
    return null;
  }

  const pnlUsd = calculatePnlUsd({
    spec,
    entryPrice: input.entryPrice,
    exitPrice: input.exitPrice,
    lots: input.lots,
    direction: input.direction,
    marketPrices: input.marketPrices,
  });
  if (pnlUsd == null || !Number.isFinite(pnlUsd)) return null;

  const accountRate = resolveAccountCurrencyToUsdRate(
    input.accountCurrency ?? "USD",
    null,
    input.marketPrices,
  );
  if (!isPositive(accountRate.rate)) return null;

  return Math.round((pnlUsd / accountRate.rate) * 100) / 100;
}

/** Conversion pairs needed by the canonical tick engine for journal P&L. */
export function tradePnlRateSymbols(pair: string, accountCurrency?: string | null): string[] {
  const canonical = canonicalizePairSymbol(pair);
  const spec = getInstrumentSpec(canonical);
  const symbols: string[] = [];

  if (
    spec &&
    spec.profitCurrency !== "USD" &&
    !requiresEntryForPipValue(canonical)
  ) {
    const conversion = requiredConversionPair(canonical);
    if (conversion) symbols.push(conversion);
  }

  const accountPair = requiredAccountCurrencyUsdPair(accountCurrency ?? "USD");
  if (accountPair && !symbols.includes(accountPair)) symbols.push(accountPair);
  return symbols;
}
