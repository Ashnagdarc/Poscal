/**
 * Server-side trade field validation (DAN-004).
 * Journal entries intentionally accept broker/custom instrument symbols. The
 * calculator remains stricter, but a trader should be able to journal any
 * instrument they actually traded.
 */

import { normalizeInstrumentToken } from "../../shared/instrumentCatalog";

const MAX_ABS_PNL = 1_000_000;
const MAX_ABS_PNL_PERCENT = 10_000;
const MAX_POSITION_SIZE = 1_000;
const MAX_RISK_PERCENT = 100;
const MAX_NOTES_LENGTH = 5_000;
const MAX_PAIR_LENGTH = 32;

const normalizePairToken = normalizeInstrumentToken;

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
  if (!/^[A-Z0-9]{2,32}$/.test(token) || token === "INVALID" || token.includes("INVALID")) {
    throw new Error("Trade instrument must contain letters or numbers");
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
