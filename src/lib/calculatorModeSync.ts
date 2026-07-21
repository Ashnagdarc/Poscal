import type { InstrumentSpec } from "./instrumentSpecs";

export function getPriceDecimals(spec: InstrumentSpec): number {
  if (spec.symbol === "XAG/USD") return 3;
  if (spec.symbol === "XAU/USD") return 2;
  if (spec.assetClass === "crypto") return 2;
  if (spec.pipSize >= 1) return 0;
  if (spec.pipSize >= 0.1) return 1;
  if (spec.pipSize >= 0.01) return 2;
  return 4;
}

export function roundPipsFromPriceDistance(distance: number, spec: InstrumentSpec): number {
  const rawPips = distance / spec.pipSize;
  const decimals =
    spec.assetClass === "metal" || spec.assetClass === "index"
      ? spec.pipSize >= 1
        ? 1
        : 2
      : spec.pipSize >= 1
        ? 0
        : spec.pipSize >= 0.1
          ? 1
          : 1;
  const factor = 10 ** decimals;
  return Math.round(rawPips * factor) / factor;
}

export function formatInstrumentPrice(value: number, spec: InstrumentSpec): string {
  return value.toFixed(getPriceDecimals(spec));
}

export function pricesToPips(input: {
  spec: InstrumentSpec;
  entryPrice: number;
  stopLossPrice: number;
  takeProfitPrice?: number | null;
}) {
  const stopLossPips = roundPipsFromPriceDistance(
    Math.abs(input.entryPrice - input.stopLossPrice),
    input.spec,
  );

  const takeProfitPips = input.takeProfitPrice
    ? roundPipsFromPriceDistance(
        Math.abs(input.takeProfitPrice - input.entryPrice),
        input.spec,
      )
    : null;

  return { stopLossPips, takeProfitPips };
}

export function pipsToPrices(input: {
  spec: InstrumentSpec;
  direction: "buy" | "sell";
  entryPrice: number;
  stopLossPips: number;
  takeProfitPips?: number | null;
}) {
  const { spec, direction, entryPrice, stopLossPips, takeProfitPips } = input;
  const stopOffset = stopLossPips * spec.pipSize;
  const tpOffset = takeProfitPips ? takeProfitPips * spec.pipSize : null;

  if (direction === "buy") {
    return {
      stopLossPrice: formatInstrumentPrice(entryPrice - stopOffset, spec),
      takeProfitPrice: tpOffset !== null
        ? formatInstrumentPrice(entryPrice + tpOffset, spec)
        : "",
    };
  }

  return {
    stopLossPrice: formatInstrumentPrice(entryPrice + stopOffset, spec),
    takeProfitPrice: tpOffset !== null
      ? formatInstrumentPrice(entryPrice - tpOffset, spec)
      : "",
  };
}
