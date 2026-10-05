export type AssetClass = "forex" | "metal" | "crypto" | "index" | "commodity";
export type InstrumentSpecSource = "poscal-fallback" | "broker" | "mt5" | "ctrader" | "custom";

export interface InstrumentSpec {
  symbol: string;
  displayName: string;
  assetClass: AssetClass;
  /** Smallest price increment used by the risk engine. */
  tickSize: number;
  /** Monetary value of one tick per standard lot in the instrument profit currency. */
  tickValueInProfitCurrency: number;
  /** User-facing pip/point unit. This is a presentation unit, not the engine primitive. */
  pipSize: number;
  /**
   * USD pip value only when it is static. Dynamic FX crosses/base-USD pairs use 0
   * and resolve through tick value plus currency conversion at runtime.
   */
  pipValuePerStandardLot: number;
  contractSize: number;
  minLot: number;
  maxLot: number;
  lotStep: number;
  baseCurrency: string;
  quoteCurrency: string;
  profitCurrency: string;
  source: InstrumentSpecSource;
  brokerSpecific: boolean;
  warning?: string;
}

const BROKER_SPECIFIC_WARNING =
  "Estimated using local instrument spec. Broker contract size, tick value, and minimum lot may differ.";

const INDEX_CFD_WARNING =
  "Index sizing uses $1 per point per lot (broker CFDs often use $5+/point). Verify against your broker contract.";

const GOLD_POINT_WARNING =
  "Gold uses the common retail convention where 1 pip = $0.10 price move = $10 per standard lot for a 100 oz contract. Broker tick size, contract size, and minimum lot may differ.";

const COMMODITY_CFD_WARNING =
  "Commodity sizing uses a local CFD tick model. Broker contract size and tick value may differ — verify before trading.";

const forexMajor = (
  symbol: string,
  displayName: string,
  extras: Partial<InstrumentSpec> = {},
): InstrumentSpec => ({
  symbol,
  displayName,
  assetClass: "forex",
  tickSize: 0.0001,
  tickValueInProfitCurrency: 10,
  pipSize: 0.0001,
  pipValuePerStandardLot: symbol.endsWith("/USD") ? 10 : 0,
  contractSize: 100000,
  baseCurrency: symbol.split("/")[0],
  quoteCurrency: symbol.split("/")[1],
  profitCurrency: symbol.split("/")[1],
  source: "poscal-fallback",
  minLot: 0.01,
  maxLot: 100,
  lotStep: 0.01,
  brokerSpecific: false,
  ...extras,
});

const forexJpy = (
  symbol: string,
  displayName: string,
  extras: Partial<InstrumentSpec> = {},
): InstrumentSpec => ({
  symbol,
  displayName,
  assetClass: "forex",
  tickSize: 0.01,
  tickValueInProfitCurrency: 1000,
  pipSize: 0.01,
  pipValuePerStandardLot: 0,
  contractSize: 100000,
  baseCurrency: symbol.split("/")[0],
  quoteCurrency: symbol.split("/")[1],
  profitCurrency: symbol.split("/")[1],
  source: "poscal-fallback",
  minLot: 0.01,
  maxLot: 100,
  lotStep: 0.01,
  brokerSpecific: false,
  ...extras,
});

const cryptoCfd = (symbol: string, displayName: string): InstrumentSpec => ({
  symbol,
  displayName,
  assetClass: "crypto",
  tickSize: 1,
  tickValueInProfitCurrency: 1,
  pipSize: 1,
  pipValuePerStandardLot: 1,
  contractSize: 1,
  baseCurrency: symbol.split("/")[0],
  quoteCurrency: symbol.split("/")[1] ?? "USD",
  profitCurrency: symbol.split("/")[1] ?? "USD",
  source: "poscal-fallback",
  minLot: 0.01,
  maxLot: 100,
  lotStep: 0.01,
  brokerSpecific: true,
  warning: BROKER_SPECIFIC_WARNING,
});

const indexCfd = (symbol: string, displayName: string): InstrumentSpec => ({
  symbol,
  displayName,
  assetClass: "index",
  tickSize: 1,
  tickValueInProfitCurrency: 1,
  pipSize: 1,
  pipValuePerStandardLot: 1,
  contractSize: 1,
  baseCurrency: symbol,
  quoteCurrency: "USD",
  profitCurrency: "USD",
  source: "poscal-fallback",
  minLot: 0.01,
  maxLot: 100,
  lotStep: 0.01,
  brokerSpecific: true,
  warning: INDEX_CFD_WARNING,
});

const commodityCfd = (
  symbol: string,
  displayName: string,
  extras: Partial<InstrumentSpec> = {},
): InstrumentSpec => ({
  symbol,
  displayName,
  assetClass: "commodity",
  tickSize: 0.01,
  tickValueInProfitCurrency: 1,
  pipSize: 0.01,
  pipValuePerStandardLot: 1,
  contractSize: 100,
  baseCurrency: symbol.split("/")[0],
  quoteCurrency: symbol.split("/")[1] ?? "USD",
  profitCurrency: symbol.split("/")[1] ?? "USD",
  source: "poscal-fallback",
  minLot: 0.01,
  maxLot: 100,
  lotStep: 0.01,
  brokerSpecific: true,
  warning: COMMODITY_CFD_WARNING,
  ...extras,
});

export const INSTRUMENT_SPECS: Record<string, InstrumentSpec> = {
  // ============== FOREX MAJORS ==============
  "EUR/USD": forexMajor("EUR/USD", "Euro / US Dollar"),
  "GBP/USD": forexMajor("GBP/USD", "British Pound / US Dollar"),
  "USD/JPY": forexJpy("USD/JPY", "US Dollar / Japanese Yen"),
  "USD/CHF": {
    ...forexMajor("USD/CHF", "US Dollar / Swiss Franc"),
    // Quote is not USD; pip value is computed from the entry price.
    pipValuePerStandardLot: 0,
  },
  "AUD/USD": forexMajor("AUD/USD", "Australian Dollar / US Dollar"),
  "USD/CAD": {
    ...forexMajor("USD/CAD", "US Dollar / Canadian Dollar"),
    // Quote is not USD; pip value is computed from the entry price.
    pipValuePerStandardLot: 0,
  },
  "NZD/USD": forexMajor("NZD/USD", "New Zealand Dollar / US Dollar"),

  // ============== FOREX CROSSES ==============
  "EUR/GBP": {
    ...forexMajor("EUR/GBP", "Euro / British Pound"),
    pipValuePerStandardLot: 0,
    warning: "Pip value uses automatic GBP/USD conversion.",
  },
  "EUR/JPY": {
    ...forexJpy("EUR/JPY", "Euro / Japanese Yen"),
    warning: "Pip value uses automatic USD/JPY conversion.",
  },
  "GBP/JPY": {
    ...forexJpy("GBP/JPY", "British Pound / Japanese Yen"),
    warning: "Pip value uses automatic USD/JPY conversion.",
  },

  // ============== CRYPTO ==============
  "BTC/USD": cryptoCfd("BTC/USD", "Bitcoin / US Dollar"),
  "ETH/USD": cryptoCfd("ETH/USD", "Ethereum / US Dollar"),
  "SOL/USD": cryptoCfd("SOL/USD", "Solana / US Dollar"),
  "XRP/USD": cryptoCfd("XRP/USD", "XRP / US Dollar"),
  "ADA/USD": cryptoCfd("ADA/USD", "Cardano / US Dollar"),

  // ============== METALS ==============
  "XAU/USD": {
    symbol: "XAU/USD",
    displayName: "Gold / US Dollar",
    assetClass: "metal",
    tickSize: 0.01,
    tickValueInProfitCurrency: 1,
    pipSize: 0.1,
    pipValuePerStandardLot: 10,
    contractSize: 100,
    baseCurrency: "XAU",
    quoteCurrency: "USD",
    profitCurrency: "USD",
    source: "poscal-fallback",
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    brokerSpecific: true,
    warning: GOLD_POINT_WARNING,
  },
  "XAG/USD": {
    symbol: "XAG/USD",
    displayName: "Silver / US Dollar",
    assetClass: "metal",
    tickSize: 0.01,
    tickValueInProfitCurrency: 50,
    pipSize: 0.01,
    pipValuePerStandardLot: 50,
    contractSize: 5000,
    baseCurrency: "XAG",
    quoteCurrency: "USD",
    profitCurrency: "USD",
    source: "poscal-fallback",
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    brokerSpecific: true,
    warning: BROKER_SPECIFIC_WARNING,
  },
  "XPT/USD": {
    symbol: "XPT/USD",
    displayName: "Platinum / US Dollar",
    assetClass: "metal",
    tickSize: 1,
    tickValueInProfitCurrency: 50,
    pipSize: 1,
    pipValuePerStandardLot: 50,
    contractSize: 50,
    baseCurrency: "XPT",
    quoteCurrency: "USD",
    profitCurrency: "USD",
    source: "poscal-fallback",
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    brokerSpecific: true,
    warning: BROKER_SPECIFIC_WARNING,
  },
  "XCU/USD": {
    symbol: "XCU/USD",
    displayName: "Copper / US Dollar",
    assetClass: "metal",
    tickSize: 0.01,
    tickValueInProfitCurrency: 25,
    pipSize: 0.01,
    // $25 per 0.01 price move. contractSize × pipSize must equal that pip value.
    pipValuePerStandardLot: 25,
    contractSize: 2500,
    baseCurrency: "XCU",
    quoteCurrency: "USD",
    profitCurrency: "USD",
    source: "poscal-fallback",
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    brokerSpecific: true,
    warning: BROKER_SPECIFIC_WARNING,
  },

  // ============== INDICES ==============
  US30: indexCfd("US30", "Dow Jones 30"),
  US100: indexCfd("US100", "Nasdaq 100"),
  US500: indexCfd("US500", "S&P 500"),
  DE40: indexCfd("DE40", "Germany 40 / DAX"),
  UK100: indexCfd("UK100", "UK 100 / FTSE 100"),
  JP225: indexCfd("JP225", "Japan 225 / Nikkei"),

  // ============== ENERGY & SOFT COMMODITIES ==============
  "WTI/USD": commodityCfd("WTI/USD", "WTI Crude Oil / US Dollar"),
  "BRENT/USD": commodityCfd("BRENT/USD", "Brent Crude Oil / US Dollar"),
  "NATGAS/USD": commodityCfd("NATGAS/USD", "Natural Gas / US Dollar", {
    tickSize: 0.001,
    tickValueInProfitCurrency: 10,
    pipSize: 0.001,
    pipValuePerStandardLot: 10,
    contractSize: 10000,
  }),
  "SOYBEAN/USD": commodityCfd("SOYBEAN/USD", "Soybeans / US Dollar", {
    tickSize: 0.25,
    tickValueInProfitCurrency: 12.5,
    pipSize: 0.25,
    pipValuePerStandardLot: 12.5,
    contractSize: 50,
  }),
  "IRON/USD": commodityCfd("IRON/USD", "Iron Ore / US Dollar", {
    tickSize: 0.01,
    tickValueInProfitCurrency: 1,
    pipSize: 0.01,
    pipValuePerStandardLot: 1,
    contractSize: 100,
  }),
};

/** Alternate broker / marketing names → canonical INSTRUMENT_SPECS keys. */
export const SYMBOL_ALIASES: Record<string, string> = {
  SPX500: "US500",
  "SPX/USD": "US500",
  NDX100: "US100",
  NAS100: "US100",
  "US100/USD": "US100",
  "US500/USD": "US500",
  "US30/USD": "US30",
  DJI: "US30",
  DAX: "DE40",
  GER30: "DE40",
  GER40: "DE40",
  "GER30/EUR": "DE40",
  NIKKEI: "JP225",
  JPN225: "JP225",
  "JPN225/USD": "JP225",
  "BCO/USD": "BRENT/USD",
  "CL/USD": "WTI/USD",
  "NG/USD": "NATGAS/USD",
  "ZS/USD": "SOYBEAN/USD",
  "COPPER/USD": "XCU/USD",
  COPPER: "XCU/USD",
};

export function normalizeInstrumentSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

/** Resolve aliases (DAX → DE40, SPX500 → US500, etc.) then normalize. */
export function resolveInstrumentSymbol(symbol: string): string {
  const normalized = normalizeInstrumentSymbol(symbol);
  return SYMBOL_ALIASES[normalized] ?? normalized;
}

export function getInstrumentSpecBySymbol(symbol: string): InstrumentSpec | undefined {
  return INSTRUMENT_SPECS[resolveInstrumentSymbol(symbol)];
}

/** Label for stop-distance input — gold, silver, indices, crypto, commodities use "points". */
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
