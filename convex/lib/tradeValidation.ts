/**
 * Server-side trade field validation (DAN-004).
 * Rejects invalid symbols, absurd P&L, and impossible sizes before persist.
 *
 * Instrument tokens stay aligned with client `INSTRUMENT_SPECS` + aliases (MC-013 / DR-003).
 */

const MAX_ABS_PNL = 1_000_000;
const MAX_ABS_PNL_PERCENT = 10_000;
const MAX_POSITION_SIZE = 1_000;
const MAX_RISK_PERCENT = 100;
const MAX_NOTES_LENGTH = 5_000;
const MAX_PAIR_LENGTH = 32;

/** Normalize "EUR/USD" → "EURUSD", "US30" stays "US30". */
const normalizePairToken = (pair: string) =>
  pair.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Tokens matching client instrumentSpecs.ts (canonical + common aliases).
 * Keep in sync when adding calculator instruments.
 */
const KNOWN_INSTRUMENT_TOKENS = new Set([
  // Forex majors
  "EURUSD",
  "GBPUSD",
  "AUDUSD",
  "NZDUSD",
  "USDCAD",
  "USDCHF",
  "USDJPY",
  // Crosses
  "EURGBP",
  "EURJPY",
  "GBPJPY",
  // Crypto
  "BTCUSD",
  "ETHUSD",
  "SOLUSD",
  "XRPUSD",
  "ADAUSD",
  // Metals
  "XAUUSD",
  "XAGUSD",
  "XPTUSD",
  "XCUUSD",
  "COPPERUSD",
  // Indices
  "US30",
  "US100",
  "US500",
  "NAS100",
  "NDX100",
  "SPX500",
  "DE40",
  "GER40",
  "GER30",
  "UK100",
  "JP225",
  "JPN225",
  "NIKKEI",
  "DAX",
  "DJI",
  // Energy / softs
  "WTIUSD",
  "BRENTUSD",
  "BCOUSD",
  "CLUSD",
  "NATGASUSD",
  "NGUSD",
  "SOYBEANUSD",
  "ZSUSD",
  "IRONUSD",
  // Free-form journal notes entries may use a sentinel.
  "JOURNAL",
]);

const formatPairTokenForDisplay = (token: string) => {
  if (/^[A-Z]{6}$/.test(token)) {
    return `${token.slice(0, 3)}/${token.slice(3)}`;
  }
  return token;
};

/** Suggest a known token for near-miss / partial input (e.g. XAUUS → XAUUSD). */
const suggestPairToken = (token: string): string | null => {
  if (!token || token === "JOURNAL" || KNOWN_INSTRUMENT_TOKENS.has(token)) {
    return null;
  }

  if (token.length >= 3) {
    const prefixMatches = [...KNOWN_INSTRUMENT_TOKENS].filter(
      (known) => known !== "JOURNAL" && known.startsWith(token),
    );
    if (prefixMatches.length === 1) {
      return prefixMatches[0] ?? null;
    }
  }

  const maxDistance = token.length <= 4 ? 1 : 2;
  let best: string | null = null;
  let bestDistance = maxDistance + 1;

  for (const known of KNOWN_INSTRUMENT_TOKENS) {
    if (known === "JOURNAL") continue;
    if (Math.abs(known.length - token.length) > maxDistance) continue;

    // Lightweight Levenshtein for short tickers
    const a = token;
    const b = known;
    const rows = a.length + 1;
    const cols = b.length + 1;
    const matrix: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));
    for (let i = 0; i < rows; i += 1) matrix[i]![0] = i;
    for (let j = 0; j < cols; j += 1) matrix[0]![j] = j;
    for (let i = 1; i < rows; i += 1) {
      for (let j = 1; j < cols; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i]![j] = Math.min(
          (matrix[i - 1]![j] ?? 0) + 1,
          (matrix[i]![j - 1] ?? 0) + 1,
          (matrix[i - 1]![j - 1] ?? 0) + cost,
        );
      }
    }
    const distance = matrix[a.length]![b.length] ?? maxDistance + 1;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = known;
    }
  }

  return bestDistance <= maxDistance ? best : null;
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export type TradeValidationInput = {
  pair: string;
  direction?: string | null;
  status?: string | null;
  entryPrice?: number | null;
  exitPrice?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
  riskPercent?: number | null;
  riskAmount?: number | null;
  positionSize?: number | null;
  pnl?: number | null;
  pnlPercent?: number | null;
  notes?: string | null;
};

export function assertValidTradeFields(input: TradeValidationInput): void {
  const pair = typeof input.pair === "string" ? input.pair.trim() : "";
  if (!pair) {
    throw new Error("Trade pair is required");
  }
  if (pair.length > MAX_PAIR_LENGTH) {
    throw new Error("Trade pair is too long");
  }

  const token = normalizePairToken(pair);
  // Allow JOURNAL sentinel and known instruments; reject obvious garbage like INVALID.
  if (token !== "JOURNAL" && !KNOWN_INSTRUMENT_TOKENS.has(token)) {
    const suggestion = suggestPairToken(token);
    const hint = suggestion
      ? ` Did you mean ${formatPairTokenForDisplay(suggestion)}?`
      : " Use a full supported symbol such as XAUUSD, EURUSD, or BTCUSD.";

    // Allow slash forms that normalize to known tokens; otherwise reject.
    if (!/^[A-Z0-9]{2,12}$/.test(token) || token === "INVALID" || token.includes("INVALID")) {
      throw new Error(`Unsupported or invalid trade pair: ${pair}.${hint}`);
    }
    // Unknown but well-formed symbols still blocked until registered.
    throw new Error(`Unsupported trade pair: ${pair}.${hint}`);
  }

  if (input.notes != null && input.notes.length > MAX_NOTES_LENGTH) {
    throw new Error("Notes are too long");
  }

  const checkNonNegativeOptional = (label: string, value: number | null | undefined) => {
    if (value == null) return;
    if (!isFiniteNumber(value)) {
      throw new Error(`${label} must be a finite number`);
    }
    if (value < 0) {
      throw new Error(`${label} cannot be negative`);
    }
  };

  checkNonNegativeOptional("Entry price", input.entryPrice);
  checkNonNegativeOptional("Exit price", input.exitPrice);
  checkNonNegativeOptional("Stop loss", input.stopLoss);
  checkNonNegativeOptional("Take profit", input.takeProfit);
  checkNonNegativeOptional("Risk amount", input.riskAmount);

  if (input.riskPercent != null) {
    if (!isFiniteNumber(input.riskPercent)) {
      throw new Error("Risk percent must be a finite number");
    }
    if (input.riskPercent < 0 || input.riskPercent > MAX_RISK_PERCENT) {
      throw new Error(`Risk percent must be between 0 and ${MAX_RISK_PERCENT}`);
    }
  }

  if (input.positionSize != null) {
    if (!isFiniteNumber(input.positionSize)) {
      throw new Error("Position size must be a finite number");
    }
    if (input.positionSize < 0 || input.positionSize > MAX_POSITION_SIZE) {
      throw new Error(`Position size must be between 0 and ${MAX_POSITION_SIZE}`);
    }
  }

  if (input.pnl != null) {
    if (!isFiniteNumber(input.pnl)) {
      throw new Error("P&L must be a finite number");
    }
    if (Math.abs(input.pnl) > MAX_ABS_PNL) {
      throw new Error(`P&L magnitude exceeds ${MAX_ABS_PNL}`);
    }
  }

  if (input.pnlPercent != null) {
    if (!isFiniteNumber(input.pnlPercent)) {
      throw new Error("P&L percent must be a finite number");
    }
    if (Math.abs(input.pnlPercent) > MAX_ABS_PNL_PERCENT) {
      throw new Error(`P&L percent magnitude exceeds ${MAX_ABS_PNL_PERCENT}`);
    }
  }
}
