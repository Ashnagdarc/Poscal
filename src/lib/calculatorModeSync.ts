import type { InstrumentSpec } from "./instrumentSpecs";

/** Quote digits describe a price, not the size or monetary value of a pip. */
export function getPriceDecimals(spec: InstrumentSpec): number {
  if (Number.isInteger(spec.quoteDigits) && spec.quoteDigits! >= 0 && spec.quoteDigits! <= 12) {
    return spec.quoteDigits!;
  }
  // Non-catalogue overrides may supply fractional tick sizes such as 0.25.
  // Do not use pipSize to infer how many digits a quote needs.
  if (spec.symbol === "XAG/USD") return 3;
  if (spec.symbol === "XAU/USD" || spec.assetClass === "crypto") return 2;
  for (let digits = 0; digits <= 12; digits += 1) {
    const scaledTick = spec.tickSize * 10 ** digits;
    if (Math.abs(scaledTick - Math.round(scaledTick)) < 1e-7) {
      return digits;
    }
  }
  return 12;
}

export function roundPipsFromPriceDistance(distance: number, spec: InstrumentSpec): number {
  const rawPips = distance / spec.pipSize;
  const decimals =
    spec.assetClass === "metal" ||
    spec.assetClass === "index" ||
    spec.assetClass === "commodity"
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
