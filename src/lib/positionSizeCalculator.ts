import { INSTRUMENT_SPECS, InstrumentSpec } from "./instrumentSpecs";

export type StopInputMode = "pips" | "price";

export interface CalculatePositionSizeInput {
  symbol: string;
  accountBalance?: number | null;
  riskPercent?: number | null;
  stopLossPips?: number | null;
  entryPrice?: number | null;
  stopLossPrice?: number | null;
  takeProfitPips?: number | null;
  takeProfitPrice?: number | null;
}

export interface CalculatePositionSizeResult {
  isValid: boolean;
  reason?: string;
  mode: StopInputMode;
  symbol: string;
  spec?: InstrumentSpec;
  riskAmount: number;
  stopLossPips: number;
  rawLotSize: number;
  positionSize: number;
  units: number;
  actualRisk: number;
  rewardToRisk: number;
  potentialProfit: number;
  pipValue: number;
  wasRounded: boolean;
  wasMinLotClamped: boolean;
  wasMaxLotClamped: boolean;
  warning?: string;
}

const EMPTY_RESULT: Omit<
  CalculatePositionSizeResult,
  "mode" | "symbol" | "spec" | "reason" | "warning"
> = {
  isValid: false,
  riskAmount: 0,
  stopLossPips: 0,
  rawLotSize: 0,
  positionSize: 0,
  units: 0,
  actualRisk: 0,
  rewardToRisk: 0,
  potentialProfit: 0,
  pipValue: 0,
  wasRounded: false,
  wasMinLotClamped: false,
  wasMaxLotClamped: false,
};

export function getInstrumentSpec(symbol: string): InstrumentSpec | undefined {
  return INSTRUMENT_SPECS[normalizeSymbol(symbol)];
}

export function calculateRiskAmount(
  accountBalance?: number | null,
  riskPercent?: number | null,
): number {
  if (!isPositiveNumber(accountBalance) || !isPositiveNumber(riskPercent)) {
    return 0;
  }

  return (accountBalance * riskPercent) / 100;
}

export function calculateStopDistance(input: {
  spec: InstrumentSpec;
  stopLossPips?: number | null;
  entryPrice?: number | null;
  stopLossPrice?: number | null;
}): { mode: StopInputMode; stopLossPips: number } {
  if (isPositiveNumber(input.stopLossPips)) {
    return { mode: "pips", stopLossPips: input.stopLossPips };
  }

  if (isPositiveNumber(input.entryPrice) && isPositiveNumber(input.stopLossPrice)) {
    const stopDistance = Math.abs(input.entryPrice - input.stopLossPrice);
    return {
      mode: "price",
      stopLossPips: stopDistance / input.spec.pipSize,
    };
  }

  return { mode: "pips", stopLossPips: 0 };
}

export function roundToLotStep(lotSize: number, lotStep: number): number {
  if (!Number.isFinite(lotSize) || lotSize <= 0 || !Number.isFinite(lotStep) || lotStep <= 0) {
    return 0;
  }

  const precision = getDecimalPrecision(lotStep);
  const multiplier = 10 ** precision;
  const steps = Math.floor((lotSize + Number.EPSILON) / lotStep);

  return Math.round(steps * lotStep * multiplier) / multiplier;
}

export function calculatePositionSize(
  input: CalculatePositionSizeInput,
): CalculatePositionSizeResult {
  const symbol = normalizeSymbol(input.symbol);
  const spec = getInstrumentSpec(symbol);
  const mode = isPositiveNumber(input.stopLossPips) ? "pips" : "price";

  if (!spec) {
    return invalidResult(symbol, mode, "Unsupported instrument");
  }

  const riskAmount = calculateRiskAmount(input.accountBalance, input.riskPercent);
  const stop = calculateStopDistance({ spec, ...input });

  if (riskAmount <= 0) {
    return invalidResult(symbol, stop.mode, "Enter account balance and risk percent", spec);
  }

  if (stop.stopLossPips <= 0) {
    return invalidResult(symbol, stop.mode, "Enter stop loss", spec, riskAmount);
  }

  if (spec.pipValuePerStandardLot <= 0) {
    return invalidResult(symbol, stop.mode, "Instrument pip value is missing", spec, riskAmount);
  }

  const rawLotSize = riskAmount / (stop.stopLossPips * spec.pipValuePerStandardLot);
  const roundedLotSize = roundToLotStep(rawLotSize, spec.lotStep);
  const wasMinLotClamped = roundedLotSize > 0 && roundedLotSize < spec.minLot;
  const wasMaxLotClamped = roundedLotSize > spec.maxLot;
  const positionSize = Math.min(
    Math.max(roundedLotSize, wasMinLotClamped ? spec.minLot : 0),
    spec.maxLot,
  );
  const actualRisk = positionSize * stop.stopLossPips * spec.pipValuePerStandardLot;
  const takeProfitPips = getTakeProfitPips(input, stop.mode, spec);
  const rewardToRisk = takeProfitPips > 0 ? takeProfitPips / stop.stopLossPips : 0;
  const potentialProfit = takeProfitPips > 0
    ? positionSize * takeProfitPips * spec.pipValuePerStandardLot
    : 0;

  return {
    isValid: true,
    mode: stop.mode,
    symbol,
    spec,
    riskAmount,
    stopLossPips: stop.stopLossPips,
    rawLotSize,
    positionSize,
    units: positionSize * spec.contractSize,
    actualRisk,
    rewardToRisk,
    potentialProfit,
    pipValue: spec.pipValuePerStandardLot,
    wasRounded: roundedLotSize !== rawLotSize,
    wasMinLotClamped,
    wasMaxLotClamped,
    warning: spec.warning,
  };
}

function getTakeProfitPips(
  input: CalculatePositionSizeInput,
  mode: StopInputMode,
  spec: InstrumentSpec,
): number {
  if (isPositiveNumber(input.takeProfitPips)) {
    return input.takeProfitPips;
  }

  if (
    mode === "price" &&
    isPositiveNumber(input.entryPrice) &&
    isPositiveNumber(input.takeProfitPrice)
  ) {
    return Math.abs(input.takeProfitPrice - input.entryPrice) / spec.pipSize;
  }

  return 0;
}

function invalidResult(
  symbol: string,
  mode: StopInputMode,
  reason: string,
  spec?: InstrumentSpec,
  riskAmount = 0,
): CalculatePositionSizeResult {
  return {
    ...EMPTY_RESULT,
    mode,
    symbol,
    spec,
    reason,
    riskAmount,
    pipValue: spec?.pipValuePerStandardLot ?? 0,
    warning: spec?.warning,
  };
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function isPositiveNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function getDecimalPrecision(value: number): number {
  const decimal = value.toString().split(".")[1];
  return decimal ? decimal.length : 0;
}

