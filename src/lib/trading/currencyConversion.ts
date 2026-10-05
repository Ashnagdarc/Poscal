export interface CurrencyToUsdRateInput {
  currency: string;
  explicitUsdRate?: number | null;
  marketPrices?: Record<string, number> | null;
  instrumentSymbol?: string | null;
  instrumentPrice?: number | null;
}

export type CurrencyToUsdRateResult =
  | { rate: number; pair: string | null; source: "identity" | "explicit" | "instrument" | "market" }
  | { rate: 0; pair: string; source: "missing"; error: string };

const isPositive = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

export function normalizeCurrencyCode(code?: string | null): string {
  const normalized = (code ?? "USD").trim().toUpperCase();
  return normalized || "USD";
}

/**
 * Preferred display/input pair for converting one unit of currency into USD.
 * The resolver itself accepts either direction, this only chooses the friendliest
 * pair for the UI and error messages.
 */
export function requiredCurrencyUsdPair(currency: string): string | null {
  const code = normalizeCurrencyCode(currency);
  if (code === "USD") return null;
  if (code === "JPY" || code === "CHF" || code === "CAD") {
    return "USD/" + code;
  }
  return code + "/USD";
}

export function resolveCurrencyToUsdRate(
  input: CurrencyToUsdRateInput,
): CurrencyToUsdRateResult {
  const currency = normalizeCurrencyCode(input.currency);
  if (currency === "USD") {
    return { rate: 1, pair: null, source: "identity" };
  }

  if (isPositive(input.explicitUsdRate)) {
    return { rate: input.explicitUsdRate, pair: null, source: "explicit" };
  }

  const directPair = currency + "/USD";
  const inversePair = "USD/" + currency;
  const instrument = (input.instrumentSymbol ?? "").trim().toUpperCase();

  if (isPositive(input.instrumentPrice)) {
    if (instrument === directPair) {
      return { rate: input.instrumentPrice, pair: directPair, source: "instrument" };
    }
    if (instrument === inversePair) {
      return { rate: 1 / input.instrumentPrice, pair: inversePair, source: "instrument" };
    }
  }

  const direct = input.marketPrices?.[directPair];
  if (isPositive(direct)) {
    return { rate: direct, pair: directPair, source: "market" };
  }

  const inverse = input.marketPrices?.[inversePair];
  if (isPositive(inverse)) {
    return { rate: 1 / inverse, pair: inversePair, source: "market" };
  }

  const preferred = requiredCurrencyUsdPair(currency) ?? directPair;
  return {
    rate: 0,
    pair: preferred,
    source: "missing",
    error: "Enter " + preferred + " conversion rate to convert " + currency + " to USD",
  };
}
