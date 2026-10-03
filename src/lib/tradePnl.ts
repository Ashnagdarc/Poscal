import { canonicalizePairSymbol } from "@/lib/pairFormat";
import {
  getInstrumentSpec,
  isCrossPair,
  requiredAccountCurrencyUsdPair,
  requiredConversionPair,
  resolveAccountCurrencyToUsdRate,
  resolveEffectivePipValue,
} from "@/lib/positionSizeCalculator";

export interface EstimateTradePnlInput {
  pair: string;
  direction: "long" | "short";
  entryPrice: number | null;
  exitPrice: number | null;
  lots: number | null;
  /** Account currency the journal stores P&L in. Defaults to USD. */
  accountCurrency?: string | null;
  marketPrices?: Record<string, number> | null;
}

const isPositive = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

/**
 * P&L in account currency from entry, exit, and lots.
 * Uses the same pip value as the position calculator, so each pair keeps its contract.
 * Returns null when a price, lot size, or required conversion rate is missing.
 */
export function estimateTradePnl(input: EstimateTradePnlInput): number | null {
  const pair = canonicalizePairSymbol(input.pair);
  const spec = getInstrumentSpec(pair);
  if (!spec || !isPositive(spec.pipSize)) return null;
  if (!isPositive(input.entryPrice) || !isPositive(input.exitPrice) || !isPositive(input.lots)) {
    return null;
  }

  const pipValue = resolveEffectivePipValue(
    spec,
    pair,
    input.entryPrice,
    input.marketPrices,
  );
  if (!isPositive(pipValue)) return null;

  const priceMove = input.exitPrice - input.entryPrice;
  const signedMove = input.direction === "short" ? -priceMove : priceMove;
  const pnlUsd = (signedMove / spec.pipSize) * pipValue * input.lots;
  if (!Number.isFinite(pnlUsd)) return null;

  const accountRate = resolveAccountCurrencyToUsdRate(
    input.accountCurrency ?? "USD",
    null,
    input.marketPrices,
  );
  if (!isPositive(accountRate.rate)) return null;

  return Math.round((pnlUsd / accountRate.rate) * 100) / 100;
}

/** Conversion pairs this estimate needs from the existing FX feed. */
export function tradePnlRateSymbols(pair: string, accountCurrency?: string | null): string[] {
  const canonical = canonicalizePairSymbol(pair);
  const symbols: string[] = [];
  if (canonical && isCrossPair(canonical)) {
    symbols.push(requiredConversionPair(canonical));
  }
  const accountPair = requiredAccountCurrencyUsdPair(accountCurrency ?? "USD");
  if (accountPair) symbols.push(accountPair);
  return symbols;
}
