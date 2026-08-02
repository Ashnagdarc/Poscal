/**
 * Server-side trade field validation (DAN-004).
 * Rejects invalid symbols, absurd P&L, and impossible sizes before persist.
 */

const MAX_ABS_PNL = 1_000_000;
const MAX_ABS_PNL_PERCENT = 10_000;
const MAX_POSITION_SIZE = 1_000;
const MAX_RISK_PERCENT = 100;
const MAX_NOTES_LENGTH = 5_000;
const MAX_PAIR_LENGTH = 32;

/** Known instrument tokens (normalized, no slash). Extend with crosses later. */
const KNOWN_INSTRUMENT_TOKENS = new Set([
  "EURUSD",
  "GBPUSD",
  "AUDUSD",
  "NZDUSD",
  "USDCAD",
  "USDCHF",
  "USDJPY",
  "EURGBP",
  "EURJPY",
  "GBPJPY",
  "XAUUSD",
  "XAGUSD",
  "BTCUSD",
  "ETHUSD",
  "US30",
  "US100",
  "US500",
  "NAS100",
  "SPX500",
  "GER40",
  "UK100",
  // Free-form journal notes entries may use a sentinel.
  "JOURNAL",
]);

const normalizePairToken = (pair: string) =>
  pair.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

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
    // Allow slash forms that normalize to known tokens; otherwise reject.
    if (!/^[A-Z0-9]{2,12}$/.test(token) || token === "INVALID" || token.includes("INVALID")) {
      throw new Error(`Unsupported or invalid trade pair: ${pair}`);
    }
    // Unknown but well-formed symbols still blocked until registered.
    throw new Error(`Unsupported trade pair: ${pair}`);
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
