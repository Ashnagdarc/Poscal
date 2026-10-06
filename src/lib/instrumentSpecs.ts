import {
  INSTRUMENT_CATALOG,
  SYMBOL_ALIASES,
  resolveCatalogSymbol,
  type AssetClass as CatalogAssetClass,
  type InstrumentCatalogEntry,
} from "../../shared/instrumentCatalog";

export type AssetClass = CatalogAssetClass;
export type InstrumentSpecSource =
  | "poscal-fallback"
  | "broker"
  | "broker-profile"
  | "mt5"
  | "ctrader"
  | "custom";

export interface InstrumentSpec extends InstrumentCatalogEntry {
  /**
   * USD pip value only when it is static. Dynamic FX crosses/base-USD pairs use
   * 0 and resolve through tick value plus currency conversion at runtime.
   */
  pipValuePerStandardLot: number;
  source: InstrumentSpecSource;
  warning?: string;
}

const BROKER_SPECIFIC_WARNING =
  "Estimated using local instrument spec. Broker contract size, tick value, and minimum lot may differ.";

const INDEX_CFD_WARNING =
  "Index sizing uses a local CFD contract. Tick value, contract size, and volume step can differ by broker.";

const GOLD_POINT_WARNING =
  "Gold uses the common retail convention where 1 pip = $0.10 price move = $10 per standard lot for a 100 oz contract. Broker tick size, contract size, and minimum lot may differ.";

const COMMODITY_CFD_WARNING =
  "Commodity sizing uses a local CFD tick model. Broker contract size and tick value may differ. Verify before trading.";

function conversionPairForProfitCurrency(currency: string): string {
  if (currency === "JPY" || currency === "CHF" || currency === "CAD") {
    return `USD/${currency}`;
  }
  return `${currency}/USD`;
}

function warningFor(entry: InstrumentCatalogEntry): string | undefined {
  if (entry.symbol === "XAU/USD") return GOLD_POINT_WARNING;
  if (entry.assetClass === "index") return INDEX_CFD_WARNING;
  if (entry.assetClass === "commodity") return COMMODITY_CFD_WARNING;
  if (entry.assetClass === "metal" || entry.assetClass === "crypto") {
    return BROKER_SPECIFIC_WARNING;
  }
  if (entry.assetClass === "forex" && entry.profitCurrency !== "USD") {
    return `Pip value uses automatic ${conversionPairForProfitCurrency(
      entry.profitCurrency,
    )} conversion.`;
  }
  return undefined;
}

function toInstrumentSpec(entry: InstrumentCatalogEntry): InstrumentSpec {
  const pipValuePerStandardLot =
    entry.profitCurrency === "USD"
      ? entry.tickValueInProfitCurrency * (entry.pipSize / entry.tickSize)
      : 0;

  return {
    ...entry,
    pipValuePerStandardLot,
    source: "poscal-fallback",
    warning: warningFor(entry),
  };
}

/**
 * Runtime calculator specifications are derived from the one shared catalogue.
 * No feature should maintain a second independent symbol registry.
 */
export const INSTRUMENT_SPECS: Record<string, InstrumentSpec> = Object.fromEntries(
  Object.values(INSTRUMENT_CATALOG).map((entry) => [
    entry.symbol,
    toInstrumentSpec(entry),
  ]),
);

export { SYMBOL_ALIASES };

export function normalizeInstrumentSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

/** Resolve aliases (DAX → DE40, SPX500 → US500, etc.) then normalize. */
export function resolveInstrumentSymbol(symbol: string): string {
  return resolveCatalogSymbol(symbol);
}

export function getInstrumentSpecBySymbol(
  symbol: string,
): InstrumentSpec | undefined {
  return INSTRUMENT_SPECS[resolveInstrumentSymbol(symbol)];
}

/** Label for stop-distance input. */
export function getStopLossUnitLabel(symbol: string): string {
  const spec = getInstrumentSpecBySymbol(symbol);
  if (!spec) return "pips";
  if (spec.symbol === "XAU/USD") return "pips ($0.10)";
  if (
    spec.assetClass === "metal" ||
    spec.assetClass === "index" ||
    spec.assetClass === "crypto" ||
    spec.assetClass === "commodity"
  ) {
    return "pts";
  }
  return "pips";
}
