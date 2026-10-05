import {
  getInstrumentSpecBySymbol,
  type InstrumentSpec,
  type InstrumentSpecSource,
} from "@/lib/instrumentSpecs";

export type InstrumentSpecOverride = Partial<
  Omit<InstrumentSpec, "symbol" | "displayName" | "assetClass">
> & {
  source?: InstrumentSpecSource;
};

const positive = (value: number): boolean => Number.isFinite(value) && value > 0;

export function isValidInstrumentSpec(spec: InstrumentSpec): boolean {
  return (
    positive(spec.contractSize) &&
    positive(spec.tickSize) &&
    positive(spec.tickValueInProfitCurrency) &&
    positive(spec.pipSize) &&
    positive(spec.minLot) &&
    positive(spec.maxLot) &&
    positive(spec.lotStep) &&
    spec.minLot <= spec.maxLot &&
    Boolean(spec.baseCurrency) &&
    Boolean(spec.quoteCurrency) &&
    Boolean(spec.profitCurrency)
  );
}

/**
 * Resolve the canonical Poscal fallback spec and optionally layer a broker,
 * platform, or custom contract specification on top.
 *
 * When contractSize or tickSize changes without an explicit tick value, the
 * native tick value is recomputed so stale fallback economics cannot leak into
 * a broker override.
 */
export function resolveInstrumentSpec(
  symbol: string,
  override?: InstrumentSpecOverride | null,
): InstrumentSpec | undefined {
  const fallback = getInstrumentSpecBySymbol(symbol);
  if (!fallback) return undefined;
  if (!override) return fallback;

  const mergedBase: InstrumentSpec = {
    ...fallback,
    ...override,
    symbol: fallback.symbol,
    displayName: fallback.displayName,
    assetClass: fallback.assetClass,
    source: override.source ?? "custom",
  };

  const economicsChanged =
    override.contractSize != null ||
    override.tickSize != null ||
    override.profitCurrency != null;

  const tickValueInProfitCurrency =
    override.tickValueInProfitCurrency != null
      ? override.tickValueInProfitCurrency
      : economicsChanged
        ? mergedBase.contractSize * mergedBase.tickSize
        : fallback.tickValueInProfitCurrency;

  const pipValuePerStandardLot =
    override.pipValuePerStandardLot != null
      ? override.pipValuePerStandardLot
      : mergedBase.profitCurrency === "USD"
        ? tickValueInProfitCurrency * (mergedBase.pipSize / mergedBase.tickSize)
        : 0;

  const resolved: InstrumentSpec = {
    ...mergedBase,
    tickValueInProfitCurrency,
    pipValuePerStandardLot,
  };

  return isValidInstrumentSpec(resolved) ? resolved : undefined;
}
