import { CURRENCY_PAIRS, type CurrencyPair } from "@/lib/currencyPairs";

export const DEFAULT_PRODUCTION_LIVE_SYMBOLS = [
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
  "AUD/JPY",
  "EUR/CHF",
  "GBP/CHF",
  "XAU/USD",
  "XAG/USD",
  "BTC/USD",
  "ETH/USD",
] as const;

const pairBySymbol = new Map(CURRENCY_PAIRS.map((pair) => [pair.symbol, pair]));

function parseConfiguredSymbols(raw: string | undefined) {
  if (!raw) {
    return [...DEFAULT_PRODUCTION_LIVE_SYMBOLS];
  }

  const values = raw
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);

  return values.length > 0 ? values : [...DEFAULT_PRODUCTION_LIVE_SYMBOLS];
}

export function getLivePairsConfig(): CurrencyPair[] {
  const configuredSymbols = parseConfiguredSymbols(import.meta.env.VITE_LIVE_SYMBOLS);

  return configuredSymbols
    .map((symbol) => pairBySymbol.get(symbol))
    .filter((pair): pair is CurrencyPair => Boolean(pair));
}

export function getLiveSymbolLabels() {
  return parseConfiguredSymbols(import.meta.env.VITE_LIVE_SYMBOLS);
}
