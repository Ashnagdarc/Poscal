import type { InstrumentSpec } from "@/lib/instrumentSpecs";
import { resolveCurrencyToUsdRate } from "@/lib/trading/currencyConversion";
import { normalizeVolumeDown } from "@/lib/trading/volume";

const positive = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

export interface TickValueResolution {
  nativeTickValue: number;
  tickValueUsd: number;
  profitCurrency: string;
  currencyToUsdRate: number;
}

export function priceDistanceFromPips(pips: number, spec: InstrumentSpec): number {
  if (!positive(pips) || !positive(spec.pipSize)) return 0;
  return pips * spec.pipSize;
}

export function pipsFromPriceDistance(distance: number, spec: InstrumentSpec): number {
  if (!positive(distance) || !positive(spec.pipSize)) return 0;
  return distance / spec.pipSize;
}

export function ticksFromPriceDistance(distance: number, spec: InstrumentSpec): number {
  if (!positive(distance) || !positive(spec.tickSize)) return 0;
  return distance / spec.tickSize;
}

export function resolveTickValueUsd(
  spec: InstrumentSpec,
  entryPrice?: number | null,
  marketPrices?: Record<string, number> | null,
): TickValueResolution | null {
  if (!positive(spec.tickValueInProfitCurrency)) return null;

  const fx = resolveCurrencyToUsdRate({
    currency: spec.profitCurrency,
    marketPrices,
    instrumentSymbol: spec.symbol,
    instrumentPrice: entryPrice,
  });

  if (!positive(fx.rate)) return null;

  return {
    nativeTickValue: spec.tickValueInProfitCurrency,
    tickValueUsd: spec.tickValueInProfitCurrency * fx.rate,
    profitCurrency: spec.profitCurrency,
    currencyToUsdRate: fx.rate,
  };
}

export function resolvePipValueUsd(
  spec: InstrumentSpec,
  entryPrice?: number | null,
  marketPrices?: Record<string, number> | null,
): number | null {
  const tick = resolveTickValueUsd(spec, entryPrice, marketPrices);
  if (!tick || !positive(spec.tickSize) || !positive(spec.pipSize)) return null;
  return tick.tickValueUsd * (spec.pipSize / spec.tickSize);
}

export interface PositionFromRiskInput {
  riskAmountUsd: number;
  priceDistance: number;
  spec: InstrumentSpec;
  entryPrice?: number | null;
  marketPrices?: Record<string, number> | null;
}

export type PositionFromRiskResult =
  | {
      isValid: true;
      ticksToStop: number;
      tickValueUsd: number;
      lossPerLotUsd: number;
      rawLotSize: number;
      roundedLotSize: number;
      positionSize: number;
      actualRiskUsd: number;
      minLotRiskUsd: number;
      wasRounded: boolean;
      wasMinLotClamped: boolean;
      wasMaxLotClamped: boolean;
    }
  | {
      isValid: false;
      code: "INVALID_INPUT" | "MISSING_TICK_VALUE" | "BELOW_MIN_VOLUME";
      ticksToStop: number;
      tickValueUsd: number;
      lossPerLotUsd: number;
      rawLotSize: number;
      minLotRiskUsd: number;
    };

export function calculatePositionFromRisk(
  input: PositionFromRiskInput,
): PositionFromRiskResult {
  if (!positive(input.riskAmountUsd) || !positive(input.priceDistance)) {
    return {
      isValid: false,
      code: "INVALID_INPUT",
      ticksToStop: 0,
      tickValueUsd: 0,
      lossPerLotUsd: 0,
      rawLotSize: 0,
      minLotRiskUsd: 0,
    };
  }

  const tick = resolveTickValueUsd(input.spec, input.entryPrice, input.marketPrices);
  const ticksToStop = ticksFromPriceDistance(input.priceDistance, input.spec);
  if (!tick || !positive(ticksToStop)) {
    return {
      isValid: false,
      code: "MISSING_TICK_VALUE",
      ticksToStop,
      tickValueUsd: 0,
      lossPerLotUsd: 0,
      rawLotSize: 0,
      minLotRiskUsd: 0,
    };
  }

  const lossPerLotUsd = ticksToStop * tick.tickValueUsd;
  const rawLotSize = input.riskAmountUsd / lossPerLotUsd;
  const roundedLotSize = normalizeVolumeDown(rawLotSize, input.spec.lotStep);
  const minLotRiskUsd = input.spec.minLot * lossPerLotUsd;

  if (rawLotSize > 0 && roundedLotSize <= 0) {
    return {
      isValid: false,
      code: "BELOW_MIN_VOLUME",
      ticksToStop,
      tickValueUsd: tick.tickValueUsd,
      lossPerLotUsd,
      rawLotSize,
      minLotRiskUsd,
    };
  }

  const wasMinLotClamped = roundedLotSize > 0 && roundedLotSize < input.spec.minLot;
  const wasMaxLotClamped = roundedLotSize > input.spec.maxLot;
  const positionSize = Math.min(
    Math.max(roundedLotSize, wasMinLotClamped ? input.spec.minLot : 0),
    input.spec.maxLot,
  );
  const actualRiskUsd = positionSize * lossPerLotUsd;

  return {
    isValid: true,
    ticksToStop,
    tickValueUsd: tick.tickValueUsd,
    lossPerLotUsd,
    rawLotSize,
    roundedLotSize,
    positionSize,
    actualRiskUsd,
    minLotRiskUsd,
    wasRounded: roundedLotSize !== rawLotSize,
    wasMinLotClamped,
    wasMaxLotClamped,
  };
}

export function calculatePnlUsd(input: {
  spec: InstrumentSpec;
  entryPrice: number;
  exitPrice: number;
  lots: number;
  direction: "long" | "short";
  marketPrices?: Record<string, number> | null;
}): number | null {
  if (
    !positive(input.entryPrice) ||
    !positive(input.exitPrice) ||
    !positive(input.lots)
  ) {
    return null;
  }

  const tick = resolveTickValueUsd(input.spec, input.entryPrice, input.marketPrices);
  if (!tick) return null;

  const move = input.exitPrice - input.entryPrice;
  const signedMove = input.direction === "short" ? -move : move;
  const signedTicks = signedMove / input.spec.tickSize;
  const pnl = signedTicks * tick.tickValueUsd * input.lots;
  return Number.isFinite(pnl) ? pnl : null;
}
