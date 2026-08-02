import {
  INSTRUMENT_SPECS,
  InstrumentSpec,
  resolveInstrumentSymbol,
} from "./instrumentSpecs";
import { roundPipsFromPriceDistance } from "./calculatorModeSync";

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
  /** Mid prices for conversion pairs, e.g. { "GBP/USD": 1.27, "USD/JPY": 150 }. User-supplied only. */
  marketPrices?: Record<string, number> | null;
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
  return INSTRUMENT_SPECS[resolveInstrumentSymbol(symbol)];
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
      stopLossPips: roundPipsFromPriceDistance(stopDistance, input.spec),
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
  const symbol = resolveInstrumentSymbol(input.symbol);
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

  if (spec.pipValuePerStandardLot <= 0 && !isCrossPair(symbol)) {
    return invalidResult(symbol, stop.mode, "Instrument pip value is missing", spec, riskAmount);
  }

  const pipValuePerLot = resolveEffectivePipValue(spec, symbol, input.entryPrice, input.marketPrices);
  if (pipValuePerLot == null || pipValuePerLot <= 0) {
    return invalidResult(
      symbol,
      stop.mode,
      requiresEntryForPipValue(symbol)
        ? "Enter entry/mid price for accurate pip value on this pair"
        : isCrossPair(symbol)
          ? `Enter ${requiredConversionPair(symbol)} conversion rate to size this cross in USD`
          : "Instrument pip value is missing",
      spec,
      riskAmount,
    );
  }

  const rawLotSize = riskAmount / (stop.stopLossPips * pipValuePerLot);
  const roundedLotSize = roundToLotStep(rawLotSize, spec.lotStep);
  const wasMinLotClamped = roundedLotSize > 0 && roundedLotSize < spec.minLot;
  const wasMaxLotClamped = roundedLotSize > spec.maxLot;
  const positionSize = Math.min(
    Math.max(roundedLotSize, wasMinLotClamped ? spec.minLot : 0),
    spec.maxLot,
  );
  const actualRisk = positionSize * stop.stopLossPips * pipValuePerLot;
  const takeProfitPips = getTakeProfitPips(input, stop.mode, spec);
  const rewardToRisk = takeProfitPips > 0 ? takeProfitPips / stop.stopLossPips : 0;
  const potentialProfit = takeProfitPips > 0
    ? positionSize * takeProfitPips * pipValuePerLot
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
    pipValue: pipValuePerLot,
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
    return roundPipsFromPriceDistance(
      Math.abs(input.takeProfitPrice - input.entryPrice),
      spec,
    );
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

function isPositiveNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function getDecimalPrecision(value: number): number {
  const decimal = value.toString().split(".")[1];
  return decimal ? decimal.length : 0;
}

/** USD-base pairs (USD/JPY, USD/CHF, USD/CAD) need a user-entered quote for accurate pip value. */
export function requiresEntryForPipValue(symbol: string): boolean {
  const normalized = resolveInstrumentSymbol(symbol);
  const [base] = normalized.split("/");
  return base === "USD" && !normalized.endsWith("/USD");
}

/** Non-USD quote crosses need a user-supplied conversion pair rate to express pip value in USD. */
export function isCrossPair(symbol: string): boolean {
  const normalized = resolveInstrumentSymbol(symbol);
  if (!normalized.includes("/")) return false;
  const [base, quote] = normalized.split("/");
  return base !== "USD" && quote !== "USD" && Boolean(base) && Boolean(quote);
}

export function requiredConversionPair(symbol: string): string {
  const normalized = resolveInstrumentSymbol(symbol);
  const [, quote] = normalized.split("/");
  if (quote === "JPY" || quote === "CHF" || quote === "CAD") {
    return `USD/${quote}`;
  }
  return `${quote}/USD`;
}

/**
 * Resolve USD pip value per standard lot.
 * Crosses: pipValueInQuote = contractSize * pipSize, then convert quote→USD.
 * EUR/GBP: 10 GBP/pip → × GBPUSD
 * EUR/JPY: 1000 JPY/pip → ÷ USDJPY
 */
export function resolveEffectivePipValue(
  spec: InstrumentSpec,
  symbol: string,
  entryPrice?: number | null,
  marketPrices?: Record<string, number> | null,
): number | null {
  const normalized = resolveInstrumentSymbol(symbol);

  if (requiresEntryForPipValue(normalized)) {
    if (!isPositiveNumber(entryPrice)) {
      return null;
    }
    return (spec.contractSize * spec.pipSize) / entryPrice;
  }

  if (isCrossPair(normalized)) {
    const pipValueInQuote = spec.contractSize * spec.pipSize;
    const conversionPair = requiredConversionPair(normalized);
    const conversionRate =
      marketPrices && isPositiveNumber(marketPrices[conversionPair])
        ? marketPrices[conversionPair]
        : null;

    if (!isPositiveNumber(conversionRate)) {
      return null;
    }

    // USD/XXX → divide; XXX/USD → multiply
    if (conversionPair.startsWith("USD/")) {
      return pipValueInQuote / conversionRate;
    }
    if (conversionPair.endsWith("/USD")) {
      return pipValueInQuote * conversionRate;
    }
    return null;
  }

  return spec.pipValuePerStandardLot;
}

