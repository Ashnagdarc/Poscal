/**
 * Client-side supported instrument tokens for journal/manual entry.
 * Canonical instruments and aliases come from the shared product catalogue.
 */

import {
  CANONICAL_INSTRUMENT_SYMBOLS,
  SUPPORTED_INSTRUMENT_TOKENS,
  normalizeInstrumentToken,
} from "../../shared/instrumentCatalog";

export const SUPPORTED_PAIR_TOKENS = [...SUPPORTED_INSTRUMENT_TOKENS] as const;

const SUPPORTED_SET = new Set<string>(SUPPORTED_PAIR_TOKENS);

/** Add Trade autocomplete shows canonical product symbols, aliases still validate. */
export const SUPPORTED_PAIR_SUGGESTIONS: string[] = [
  ...CANONICAL_INSTRUMENT_SYMBOLS,
];

export function normalizePairToken(pair: string): string {
  return normalizeInstrumentToken(pair);
}

export function isSupportedPairToken(token: string): boolean {
  return token === "JOURNAL" || SUPPORTED_SET.has(token);
}

export function formatPairTokenForDisplay(token: string): string {
  if (/^[A-Z]{6}$/.test(token)) {
    return `${token.slice(0, 3)}/${token.slice(3)}`;
  }
  return token;
}

/** Levenshtein distance capped early for short ticker symbols. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

/**
 * Suggest a known token for typos / partials (e.g. XAUUS → XAUUSD).
 * Returns null when already valid or no confident match.
 */
export function suggestPairToken(input: string): string | null {
  const token = normalizePairToken(input);
  if (!token || isSupportedPairToken(token)) return null;

  // Unique prefix completion (XAUUS → XAUUSD, EUR → multiple → no auto-pick)
  if (token.length >= 3) {
    const prefixMatches = SUPPORTED_PAIR_TOKENS.filter((known) => known.startsWith(token));
    if (prefixMatches.length === 1) return prefixMatches[0];
  }

  // Close edit distance for near-misses (XAUUD → XAUUSD)
  const maxDistance = token.length <= 4 ? 1 : 2;
  let best: string | null = null;
  let bestDistance = maxDistance + 1;

  for (const known of SUPPORTED_PAIR_TOKENS) {
    // Skip wildly different lengths (except short indices)
    if (Math.abs(known.length - token.length) > maxDistance) continue;
    const distance = editDistance(token, known);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = known;
    } else if (distance === bestDistance && best && known.length === token.length) {
      // Prefer same-length when tied
      best = known;
    }
  }

  return bestDistance <= maxDistance ? best : null;
}

export type PairValidationResult =
  | { ok: true; token: string }
  | { ok: false; token: string; message: string; suggestion: string | null };

export function validateTradePairInput(pair: string): PairValidationResult {
  const token = normalizePairToken(pair);
  if (!token) {
    return {
      ok: false,
      token: "",
      message: "Enter a trading symbol (e.g. XAUUSD or EUR/USD).",
      suggestion: null,
    };
  }

  if (token === "INVALID" || token.includes("INVALID")) {
    return {
      ok: false,
      token,
      message: "That symbol looks invalid. Try a real pair like XAUUSD.",
      suggestion: null,
    };
  }

  if (isSupportedPairToken(token)) {
    return { ok: true, token };
  }

  const suggestion = suggestPairToken(token);
  if (suggestion) {
    return {
      ok: false,
      token,
      message: `“${pair.trim().toUpperCase()}” isn’t a supported symbol. Did you mean ${formatPairTokenForDisplay(suggestion)}?`,
      suggestion,
    };
  }

  return {
    ok: false,
    token,
    message: `“${pair.trim().toUpperCase()}” isn’t supported. Try XAUUSD, EURUSD, BTCUSD, or another listed pair.`,
    suggestion: null,
  };
}
