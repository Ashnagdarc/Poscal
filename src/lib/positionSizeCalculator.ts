import type { InstrumentSpec } from "./instrumentSpecs";
import { resolveInstrumentSymbol } from "./instrumentSpecs";
import { roundPipsFromPriceDistance } from "./calculatorModeSync";
import {
  calculatePositionFromRisk,
  priceDistanceFromPips,
  resolvePipValueUsd,
} from "./trading/engine";
import {
  normalizeCurrencyCode,
  requiredCurrencyUsdPair,
  resolveCurrencyToUsdRate,
} from "./trading/currencyConversion";
import {
  resolveInstrumentSpec,
  type InstrumentSpecOverride,
} from "./trading/instrumentResolver";
import { normalizeVolumeDown } from "./trading/volume";

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
  direction?: "buy" | "sell" | null;
  marketPrices?: Record<string, number> | null;
  accountCurrency?: string | null;
  accountCurrencyUsdRate?: number | null;
  /**
   * Optional broker/platform contract override. The calculator engine does not
   * contain pair-specific math, it consumes this normalized specification.
   */
  instrumentSpecOverride?: InstrumentSpecOverride | null;
}

export interface CalculatePositionSizeResult {
  isValid: boolean;
  reason?: string;
  mode: StopInputMode;
  symbol: string;
  spec?: InstrumentSpec;
  riskAmount: number;
  riskAmountUsd: number;
  accountCurrency: string;
  stopLossPips: number;
  /** Raw price distance between entry and stop, or pip input converted to price. */
  priceDistance: number;
  /** Number of instrument ticks between entry and stop. */
  ticksToStop: number;
  /** USD value of one tick per standard lot after profit-currency conversion. */
  tickValue: number;
  /** USD loss for one standard lot at the selected stop distance. */
  lossPerLotUsd: number;
  rawLotSize: number;
  positionSize: number;
  units: number;
  actualRisk: number;
  actualRiskUsd: number;
  rewardToRisk: number;
  potentialProfit: number;
  potentialProfitAccount: number;
  /** USD pip/point value, kept for UI/backward compatibility. */
  pipValue: number;
  specSource: InstrumentSpec["source"] | null;
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
  riskAmountUsd: 0,
  accountCurrency: "USD",
  stopLossPips: 0,
  priceDistance: 0,
  ticksToStop: 0,
  tickValue: 0,
  lossPerLotUsd: 0,
  rawLotSize: 0,
  positionSize: 0,
  units: 0,
  actualRisk: 0,
  actualRiskUsd: 0,
  rewardToRisk: 0,
  potentialProfit: 0,
  potentialProfitAccount: 0,
  pipValue: 0,
  specSource: null,
  wasRounded: false,
  wasMinLotClamped: false,
  wasMaxLotClamped: false,
};

export function getInstrumentSpec(symbol: string): InstrumentSpec | undefined {
  return resolveInstrumentSpec(symbol);
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
}): { mode: StopInputMode; stopLossPips: number; priceDistance: number } {
  if (isPositiveNumber(input.stopLossPips)) {
    return {
      mode: "pips",
      stopLossPips: input.stopLossPips,
      priceDistance: priceDistanceFromPips(input.stopLossPips, input.spec),
    };
  }

  if (isPositiveNumber(input.entryPrice) && isPositiveNumber(input.stopLossPrice)) {
    const priceDistance = Math.abs(input.entryPrice - input.stopLossPrice);
    return {
      mode: "price",
      stopLossPips: roundPipsFromPriceDistance(priceDistance, input.spec),
      priceDistance,
    };
  }

  return { mode: "pips", stopLossPips: 0, priceDistance: 0 };
}

export function roundToLotStep(lotSize: number, lotStep: number): number {
  return normalizeVolumeDown(lotSize, lotStep);
}

export function calculatePositionSize(
  input: CalculatePositionSizeInput,
): CalculatePositionSizeResult {
  const symbol = resolveInstrumentSymbol(input.symbol);
  const mode = isPositiveNumber(input.stopLossPips) ? "pips" : "price";
  const accountCurrency = normalizeAccountCurrency(input.accountCurrency);
  const spec = resolveInstrumentSpec(symbol, input.instrumentSpecOverride);

  if (!spec) {
    return invalidResult(
      symbol,
      mode,
      symbol
        ? symbol + " is not a supported instrument or its contract spec is invalid."
        : "Pick a pair from the list.",
      undefined,
      0,
      accountCurrency,
    );
  }

  const riskAmount = calculateRiskAmount(input.accountBalance, input.riskPercent);
  const stop = calculateStopDistance({ spec, ...input });

  if (riskAmount <= 0) {
    return invalidResult(
      symbol,
      stop.mode,
      "Enter account balance and risk percent",
      spec,
      0,
      accountCurrency,
    );
  }

  if (!isPositiveNumber(input.stopLossPips)) {
    const sideError = priceStopSideError(input);
    if (sideError) {
      return invalidResult(
        symbol,
        "price",
        sideError,
        spec,
        riskAmount,
        accountCurrency,
      );
    }
  }

  if (stop.priceDistance <= 0) {
    return invalidResult(
      symbol,
      stop.mode,
      "Enter stop loss",
      spec,
      riskAmount,
      accountCurrency,
    );
  }

  const accountFx = resolveCurrencyToUsdRate({
    currency: accountCurrency,
    explicitUsdRate: input.accountCurrencyUsdRate,
    marketPrices: input.marketPrices,
  });

  if (accountFx.source === "missing") {
    return invalidResult(
      symbol,
      stop.mode,
      accountFx.error,
      spec,
      riskAmount,
      accountCurrency,
    );
  }

  const accountToUsd = accountFx.rate;
  const riskAmountUsd = riskAmount * accountToUsd;
  const engine = calculatePositionFromRisk({
    riskAmountUsd,
    priceDistance: stop.priceDistance,
    spec,
    entryPrice: input.entryPrice,
    marketPrices: input.marketPrices,
  });

  if (engine.isValid === false) {
    if (engine.code === "BELOW_MIN_VOLUME") {
      const minLotRisk =
        accountToUsd > 0 ? engine.minLotRiskUsd / accountToUsd : engine.minLotRiskUsd;
      return invalidResult(
        symbol,
        stop.mode,
        "Risk is too small for the minimum lot (" +
          spec.minLot +
          "). That lot would risk " +
          minLotRisk.toFixed(2) +
          " " +
          accountCurrency +
          ", above the " +
          riskAmount.toFixed(2) +
          " " +
          accountCurrency +
          " you set.",
        spec,
        riskAmount,
        accountCurrency,
        resolvePipValueUsd(spec, input.entryPrice, input.marketPrices) ?? 0,
      );
    }

    return invalidResult(
      symbol,
      stop.mode,
      missingTickValueReason(spec, symbol),
      spec,
      riskAmount,
      accountCurrency,
    );
  }

  const pipValue =
    resolvePipValueUsd(spec, input.entryPrice, input.marketPrices) ??
    engine.tickValueUsd * (spec.pipSize / spec.tickSize);
  const actualRiskUsd = engine.actualRiskUsd;
  const actualRisk = actualRiskUsd / accountToUsd;

  const takeProfitDistance = getTakeProfitDistance(input, stop.mode, spec);
  const takeProfitPips =
    takeProfitDistance > 0
      ? roundPipsFromPriceDistance(takeProfitDistance, spec)
      : 0;
  const rewardToRisk =
    takeProfitDistance > 0 ? takeProfitDistance / stop.priceDistance : 0;
  const potentialProfitUsd =
    takeProfitDistance > 0
      ? engine.positionSize *
        (takeProfitDistance / spec.tickSize) *
        engine.tickValueUsd
      : 0;
  const potentialProfitAccount = potentialProfitUsd / accountToUsd;

  const multiCcyNote =
    accountCurrency !== "USD"
      ? "Risk " +
        riskAmount.toFixed(2) +
        " " +
        accountCurrency +
        " ≈ $" +
        riskAmountUsd.toFixed(2) +
        " USD (rate " +
        accountToUsd.toFixed(4) +
        ")."
      : undefined;
  const lotBoundNote = describeLotBound(
    engine.wasMinLotClamped,
    engine.wasMaxLotClamped,
    spec,
    actualRisk,
    riskAmount,
    accountCurrency,
  );

  return {
    isValid: true,
    mode: stop.mode,
    symbol,
    spec,
    riskAmount,
    riskAmountUsd,
    accountCurrency,
    stopLossPips: stop.stopLossPips,
    priceDistance: stop.priceDistance,
    ticksToStop: engine.ticksToStop,
    tickValue: engine.tickValueUsd,
    lossPerLotUsd: engine.lossPerLotUsd,
    rawLotSize: engine.rawLotSize,
    positionSize: engine.positionSize,
    units: engine.positionSize * spec.contractSize,
    actualRisk,
    actualRiskUsd,
    rewardToRisk,
    potentialProfit: potentialProfitUsd,
    potentialProfitAccount,
    pipValue,
    specSource: spec.source,
    wasRounded: engine.wasRounded,
    wasMinLotClamped: engine.wasMinLotClamped,
    wasMaxLotClamped: engine.wasMaxLotClamped,
    warning: [spec.warning, multiCcyNote, lotBoundNote].filter(Boolean).join(" "),
  };
}

function missingTickValueReason(spec: InstrumentSpec, symbol: string): string {
  if (requiresEntryForPipValue(symbol)) {
    return "Enter entry/mid price for accurate tick value on this pair";
  }
  if (spec.profitCurrency !== "USD") {
    const pair = requiredCurrencyUsdPair(spec.profitCurrency);
    return pair
      ? "Enter " + pair + " conversion rate to size this instrument in USD"
      : "Profit-currency conversion rate is missing";
  }
  return "Instrument tick value is missing";
}

function describeLotBound(
  wasMinLotClamped: boolean,
  wasMaxLotClamped: boolean,
  spec: InstrumentSpec,
  actualRisk: number,
  riskAmount: number,
  accountCurrency: string,
): string | undefined {
  if (wasMaxLotClamped) {
    return (
      "Position size is capped at " +
      spec.maxLot +
      " lots. Actual risk is " +
      actualRisk.toFixed(2) +
      " " +
      accountCurrency +
      ", below the " +
      riskAmount.toFixed(2) +
      " " +
      accountCurrency +
      " you set."
    );
  }
  if (wasMinLotClamped) {
    return (
      "Minimum lot (" +
      spec.minLot +
      ") raises actual risk to " +
      actualRisk.toFixed(2) +
      " " +
      accountCurrency +
      ", above the " +
      riskAmount.toFixed(2) +
      " " +
      accountCurrency +
      " you set."
    );
  }
  return undefined;
}

function priceStopSideError(input: CalculatePositionSizeInput): string | null {
  const direction = input.direction;
  if (direction !== "buy" && direction !== "sell") return null;
  if (!isPositiveNumber(input.entryPrice) || !isPositiveNumber(input.stopLossPrice)) {
    return null;
  }

  if (direction === "buy") {
    return input.stopLossPrice >= input.entryPrice
      ? "Buy stop must be below the entry price"
      : null;
  }
  return input.stopLossPrice <= input.entryPrice
    ? "Sell stop must be above the entry price"
    : null;
}

function getTakeProfitDistance(
  input: CalculatePositionSizeInput,
  mode: StopInputMode,
  spec: InstrumentSpec,
): number {
  if (isPositiveNumber(input.takeProfitPips)) {
    return priceDistanceFromPips(input.takeProfitPips, spec);
  }

  if (
    mode === "price" &&
    isPositiveNumber(input.entryPrice) &&
    isPositiveNumber(input.takeProfitPrice)
  ) {
    return Math.abs(input.takeProfitPrice - input.entryPrice);
  }

  return 0;
}

function invalidResult(
  symbol: string,
  mode: StopInputMode,
  reason: string,
  spec?: InstrumentSpec,
  riskAmount = 0,
  accountCurrency = "USD",
  pipValue?: number,
): CalculatePositionSizeResult {
  const staticPip =
    spec?.profitCurrency === "USD" ? spec.pipValuePerStandardLot : 0;

  return {
    ...EMPTY_RESULT,
    mode,
    symbol,
    spec,
    reason,
    riskAmount,
    riskAmountUsd: accountCurrency === "USD" ? riskAmount : 0,
    accountCurrency,
    pipValue: pipValue ?? staticPip ?? 0,
    specSource: spec?.source ?? null,
    warning: spec?.warning,
  };
}

function isPositiveNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function normalizeAccountCurrency(code?: string | null): string {
  return normalizeCurrencyCode(code);
}

export function requiredAccountCurrencyUsdPair(
  accountCurrency: string,
): string | null {
  return requiredCurrencyUsdPair(accountCurrency);
}

export function resolveAccountCurrencyToUsdRate(
  accountCurrency: string,
  explicitRate?: number | null,
  marketPrices?: Record<string, number> | null,
): { rate: number; error?: undefined } | { rate: 0; error: string } {
  const resolved = resolveCurrencyToUsdRate({
    currency: accountCurrency,
    explicitUsdRate: explicitRate,
    marketPrices,
  });

  if (resolved.source === "missing") {
    return { rate: 0, error: resolved.error };
  }
  return { rate: resolved.rate };
}

export function requiresEntryForPipValue(symbol: string): boolean {
  const spec = resolveInstrumentSpec(symbol);
  if (!spec || spec.profitCurrency === "USD") return false;
  return spec.symbol === "USD/" + spec.profitCurrency;
}

export function isCrossPair(symbol: string): boolean {
  const normalized = resolveInstrumentSymbol(symbol);
  if (!normalized.includes("/")) return false;
  const [base, quote] = normalized.split("/");
  return base !== "USD" && quote !== "USD" && Boolean(base) && Boolean(quote);
}

export function requiredConversionPair(symbol: string): string {
  const spec = resolveInstrumentSpec(symbol);
  if (spec?.profitCurrency && spec.profitCurrency !== "USD") {
    return requiredCurrencyUsdPair(spec.profitCurrency) ?? "";
  }

  const normalized = resolveInstrumentSymbol(symbol);
  const [, quote] = normalized.split("/");
  return requiredCurrencyUsdPair(quote) ?? "";
}

export function resolveEffectivePipValue(
  spec: InstrumentSpec,
  _symbol: string,
  entryPrice?: number | null,
  marketPrices?: Record<string, number> | null,
): number | null {
  return resolvePipValueUsd(spec, entryPrice, marketPrices);
}
