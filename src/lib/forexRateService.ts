/**
 * Fetch mid FX rates for position-sizing conversion pairs.
 * Uses ECB daily rates via Frankfurter (no API key) — same approach free
 * calculators use so crosses like EUR/JPY do not require a typed USD/JPY.
 */

const FRANKFURTER_LATEST = "https://api.frankfurter.dev/v1/latest";

/** Currencies we may need as quote/base for featured forex instruments. */
const TRACKED_VS_USD = [
  "EUR",
  "GBP",
  "JPY",
  "CHF",
  "CAD",
  "AUD",
  "NZD",
  "INR",
  "ZAR",
  "NGN",
] as const;

export type ForexMidPrices = Record<string, number>;

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Build slash-pair mid map from USD-based ECB rates.
 * USD/XXX = rates[XXX]; XXX/USD = 1 / rates[XXX].
 */
export function midPricesFromUsdRates(
  usdRates: Record<string, number>,
): ForexMidPrices {
  const prices: ForexMidPrices = {};

  for (const ccy of TRACKED_VS_USD) {
    const vsUsd = usdRates[ccy];
    if (!isPositiveNumber(vsUsd)) continue;

    // Always expose both directions for account FX + conversion pairs.
    prices[`USD/${ccy}`] = vsUsd;
    prices[`${ccy}/USD`] = 1 / vsUsd;
  }

  return prices;
}

export async function fetchForexMidPrices(
  fetchImpl: typeof fetch = fetch,
): Promise<ForexMidPrices> {
  const url = `${FRANKFURTER_LATEST}?base=USD&symbols=${TRACKED_VS_USD.join(",")}`;
  const response = await fetchImpl(url);

  if (!response.ok) {
    throw new Error(`Forex rate feed failed (${response.status})`);
  }

  const body = (await response.json()) as {
    rates?: Record<string, number>;
  };

  if (!body.rates || typeof body.rates !== "object") {
    throw new Error("Forex rate feed returned no rates");
  }

  const prices = midPricesFromUsdRates(body.rates);
  if (Object.keys(prices).length === 0) {
    throw new Error("Forex rate feed returned empty conversion map");
  }

  return prices;
}

/** Pick only the pairs the calculator currently needs. */
export function pickMarketPrices(
  all: ForexMidPrices | null | undefined,
  symbols: Array<string | null | undefined>,
): ForexMidPrices | null {
  if (!all) return null;

  const picked: ForexMidPrices = {};
  for (const symbol of symbols) {
    if (!symbol) continue;
    const rate = all[symbol];
    if (isPositiveNumber(rate)) {
      picked[symbol] = rate;
    }
  }

  return Object.keys(picked).length > 0 ? picked : null;
}
