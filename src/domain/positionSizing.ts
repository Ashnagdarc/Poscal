import type { MarketQuote, PositionSizeInput, PositionSizeResult, ResolvedInstrument, TradeSide } from "./types";

function assertPositiveNumber(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be greater than zero`);
  }
}

function countDecimals(value: number): number {
  const normalized = value.toString();
  if (!normalized.includes(".")) {
    return 0;
  }

  return normalized.split(".")[1]?.length ?? 0;
}

function roundDownToStep(value: number, step: number): number {
  if (step <= 0) {
    return value;
  }

  const precision = Math.max(countDecimals(step), 0);
  const normalizedValue = Number(value.toFixed(precision + 6));
  const steps = Math.floor((normalizedValue / step) + 1e-9);
  const rounded = steps * step;
  return Number(rounded.toFixed(precision));
}

function getExecutionPrice(side: TradeSide, quote?: MarketQuote): number {
  if (!quote) {
    throw new Error("Market orders require a live quote");
  }

  const executionPrice = side === "buy"
    ? quote.ask ?? quote.mid
    : quote.bid ?? quote.mid;

  if (!executionPrice || executionPrice <= 0) {
    throw new Error(`Market ${side} orders require a valid ${side === "buy" ? "ask" : "bid"} price`);
  }

  return executionPrice;
}

function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  conversionRates: Record<string, number> = {},
): number {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  const directRate = conversionRates[`${fromCurrency}/${toCurrency}`];
  if (typeof directRate === "number" && directRate > 0) {
    return amount * directRate;
  }

  const inverseRate = conversionRates[`${toCurrency}/${fromCurrency}`];
  if (typeof inverseRate === "number" && inverseRate > 0) {
    return amount / inverseRate;
  }

  throw new Error(`Missing conversion rate for ${fromCurrency}/${toCurrency}`);
}

export function calculatePipValueInAccountCurrency(
  instrument: ResolvedInstrument,
  accountCurrency: string,
  conversionRates?: Record<string, number>,
  referencePrice?: number,
): number {
  const pipValueInQuoteCurrency = instrument.contractSize * instrument.pipSize;

  if (
    instrument.baseCurrency === accountCurrency &&
    typeof referencePrice === "number" &&
    referencePrice > 0
  ) {
    return pipValueInQuoteCurrency / referencePrice;
  }

  return convertCurrency(
    pipValueInQuoteCurrency,
    instrument.quoteCurrency,
    accountCurrency,
    conversionRates,
  );
}

export function calculatePositionSize(input: PositionSizeInput): PositionSizeResult {
  assertPositiveNumber(input.accountBalance, "Account balance");
  assertPositiveNumber(input.riskPercent, "Risk percent");
  assertPositiveNumber(input.stopLossPrice, "Stop loss");
  assertPositiveNumber(input.takeProfitPrice, "Take profit");

  const orderType = input.orderType ?? "limit";
  const accountCurrency = input.broker.accountCurrency;
  const entryPrice = orderType === "market"
    ? getExecutionPrice(input.side, input.marketQuote)
    : input.entryPrice;

  if (!entryPrice || entryPrice <= 0) {
    throw new Error("Entry price must be provided for non-market orders");
  }

  const stopDistancePrice = Math.abs(entryPrice - input.stopLossPrice);
  const rewardDistancePrice = Math.abs(input.takeProfitPrice - entryPrice);

  assertPositiveNumber(stopDistancePrice, "Stop distance");
  assertPositiveNumber(rewardDistancePrice, "Reward distance");

  const stopDistancePips = stopDistancePrice / input.instrument.pipSize;
  const rewardDistancePips = rewardDistancePrice / input.instrument.pipSize;
  const pipValueInAccountCurrency = calculatePipValueInAccountCurrency(
    input.instrument,
    accountCurrency,
    input.conversionRates,
    entryPrice,
  );
  const riskAmount = input.accountBalance * (input.riskPercent / 100);
  const riskPerLot = stopDistancePips * pipValueInAccountCurrency;
  const rawLots = riskAmount / riskPerLot;
  const boundedLots = input.instrument.maxLot
    ? Math.min(rawLots, input.instrument.maxLot)
    : rawLots;
  const roundedLots = roundDownToStep(boundedLots, input.instrument.lotStep);
  const lots = roundedLots >= input.instrument.minLot ? roundedLots : 0;
  const units = lots * input.instrument.contractSize;
  const actualRiskAmount = lots * riskPerLot;
  const notionalValue = units * entryPrice;

  return {
    entryPrice,
    stopDistancePrice,
    stopDistancePips,
    rewardDistancePrice,
    rewardDistancePips,
    riskAmount,
    riskPerLot,
    rawLots,
    lots,
    units,
    pipValueInAccountCurrency,
    notionalValue,
    actualRiskAmount,
    actualRiskPercent: input.accountBalance > 0 ? (actualRiskAmount / input.accountBalance) * 100 : 0,
    rewardRiskRatio: rewardDistancePips / stopDistancePips,
    isBelowMinimumLot: lots === 0,
  };
}
