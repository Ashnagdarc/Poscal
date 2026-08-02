export type AssetClass = "forex" | "metal" | "crypto" | "index" | "commodity";

export interface InstrumentSpec {
  symbol: string;
  displayName: string;
  assetClass: AssetClass;
  pipSize: number;
  pipValuePerStandardLot: number;
  contractSize: number;
  minLot: number;
  maxLot: number;
  lotStep: number;
  brokerSpecific: boolean;
  warning?: string;
}

const BROKER_SPECIFIC_WARNING =
  "Estimated using local instrument spec. Broker contract size, tick value, and minimum lot may differ.";

const INDEX_CFD_WARNING =
  "Index sizing uses $1 per point per lot (broker CFDs often use $5+/point). Verify against your broker contract.";

const GOLD_POINT_WARNING =
  "Gold uses points where 1 pt = $1 price move ≈ $100 / standard lot. This is not the $0.01-pip convention some platforms use.";

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
  pipSize: 0.0001,
  pipValuePerStandardLot: 10,
  contractSize: 100000,
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
  pipSize: 0.01,
  pipValuePerStandardLot: 0,
  contractSize: 100000,
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
  pipSize: 1,
  pipValuePerStandardLot: 1,
  contractSize: 1,
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
  pipSize: 1,
  pipValuePerStandardLot: 1,
  contractSize: 1,
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
  pipSize: 0.01,
  pipValuePerStandardLot: 1,
  contractSize: 100,
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
  "USD/JPY": {
    ...forexJpy("USD/JPY", "US Dollar / Japanese Yen"),
    // Fallback only; live sizing prefers entry-based pip value.
    pipValuePerStandardLot: 6.15,
  },
  "USD/CHF": {
    ...forexMajor("USD/CHF", "US Dollar / Swiss Franc"),
    pipValuePerStandardLot: 11.3,
  },
  "AUD/USD": forexMajor("AUD/USD", "Australian Dollar / US Dollar"),
  "USD/CAD": {
    ...forexMajor("USD/CAD", "US Dollar / Canadian Dollar"),
    pipValuePerStandardLot: 7.38,
  },
  "NZD/USD": forexMajor("NZD/USD", "New Zealand Dollar / US Dollar"),

  // ============== FOREX CROSSES ==============
  "EUR/GBP": {
    ...forexMajor("EUR/GBP", "Euro / British Pound"),
    pipValuePerStandardLot: 0,
    warning: "Enter a GBP/USD conversion rate for USD account sizing.",
  },
  "EUR/JPY": {
    ...forexJpy("EUR/JPY", "Euro / Japanese Yen"),
    warning: "Enter a USD/JPY conversion rate for USD account sizing.",
  },
  "GBP/JPY": {
    ...forexJpy("GBP/JPY", "British Pound / Japanese Yen"),
    warning: "Enter a USD/JPY conversion rate for USD account sizing.",
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
    pipSize: 1,
    pipValuePerStandardLot: 100,
    contractSize: 100,
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
    pipSize: 0.01,
    pipValuePerStandardLot: 50,
    contractSize: 5000,
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
    pipSize: 1,
    pipValuePerStandardLot: 50,
    contractSize: 50,
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
    pipSize: 0.01,
    pipValuePerStandardLot: 25,
    contractSize: 25000,
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
    pipSize: 0.001,
    pipValuePerStandardLot: 10,
    contractSize: 10000,
  }),
  "SOYBEAN/USD": commodityCfd("SOYBEAN/USD", "Soybeans / US Dollar", {
    pipSize: 0.25,
    pipValuePerStandardLot: 12.5,
    contractSize: 50,
  }),
  "IRON/USD": commodityCfd("IRON/USD", "Iron Ore / US Dollar", {
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
  if (spec.symbol === "XAU/USD") return "pts ($1)";
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
