export type AssetClass = "forex" | "metal" | "crypto" | "index" | "commodity";

export interface InstrumentCatalogEntry {
  symbol: string;
  displayName: string;
  assetClass: AssetClass;
  /** Smallest price increment used by the risk engine. */
  tickSize: number;
  /** Native monetary value of one tick per standard lot, denominated in profitCurrency. */
  tickValueInProfitCurrency: number;
  /** User-facing pip/point unit. */
  pipSize: number;
  /** Decimal places in the commonly quoted price. Independent of pip/tick economics. */
  quoteDigits?: number;
  contractSize: number;
  minLot: number;
  maxLot: number;
  lotStep: number;
  baseCurrency: string;
  quoteCurrency: string;
  profitCurrency: string;
  /** False for standard 100k FX contracts. CFDs should remain explicit about broker variance. */
  brokerSpecific: boolean;
}

const STANDARD_FX_CONTRACT = 100_000;

function forexPair(symbol: string, displayName: string): InstrumentCatalogEntry {
  const [baseCurrency, quoteCurrency] = symbol.split("/");
  const isJpyQuote = quoteCurrency === "JPY";
  const pipSize = isJpyQuote ? 0.01 : 0.0001;
  const tickSize = pipSize / 10;

  return {
    symbol,
    displayName,
    assetClass: "forex",
    tickSize,
    tickValueInProfitCurrency: STANDARD_FX_CONTRACT * tickSize,
    pipSize,
    quoteDigits: isJpyQuote ? 3 : 5,
    contractSize: STANDARD_FX_CONTRACT,
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    baseCurrency,
    quoteCurrency,
    profitCurrency: quoteCurrency,
    brokerSpecific: false,
  };
}

function cryptoCfd(symbol: string, displayName: string): InstrumentCatalogEntry {
  const [baseCurrency, quoteCurrency = "USD"] = symbol.split("/");
  return {
    symbol,
    displayName,
    assetClass: "crypto",
    tickSize: 1,
    tickValueInProfitCurrency: 1,
    pipSize: 1,
    quoteDigits: 2,
    contractSize: 1,
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    baseCurrency,
    quoteCurrency,
    profitCurrency: quoteCurrency,
    brokerSpecific: true,
  };
}

function indexCfd(symbol: string, displayName: string): InstrumentCatalogEntry {
  return {
    symbol,
    displayName,
    assetClass: "index",
    tickSize: 1,
    tickValueInProfitCurrency: 1,
    pipSize: 1,
    quoteDigits: 2,
    contractSize: 1,
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    baseCurrency: symbol,
    quoteCurrency: "USD",
    profitCurrency: "USD",
    brokerSpecific: true,
  };
}

function commodityCfd(
  symbol: string,
  displayName: string,
  overrides: Partial<InstrumentCatalogEntry> = {},
): InstrumentCatalogEntry {
  const [baseCurrency, quoteCurrency = "USD"] = symbol.split("/");
  return {
    symbol,
    displayName,
    assetClass: "commodity",
    tickSize: 0.01,
    tickValueInProfitCurrency: 1,
    pipSize: 0.01,
    contractSize: 100,
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    baseCurrency,
    quoteCurrency,
    profitCurrency: quoteCurrency,
    brokerSpecific: true,
    ...overrides,
  };
}

/**
 * Single product catalogue for calculator, journal selectors, aliases and
 * server-side trade validation. Calculation code must consume these contracts
 * rather than maintain separate symbol lists.
 */
export const INSTRUMENT_CATALOG: Record<string, InstrumentCatalogEntry> = {
  // ================= FOREX MAJORS =================
  "EUR/USD": forexPair("EUR/USD", "Euro / US Dollar"),
  "GBP/USD": forexPair("GBP/USD", "British Pound / US Dollar"),
  "USD/JPY": forexPair("USD/JPY", "US Dollar / Japanese Yen"),
  "USD/CHF": forexPair("USD/CHF", "US Dollar / Swiss Franc"),
  "AUD/USD": forexPair("AUD/USD", "Australian Dollar / US Dollar"),
  "USD/CAD": forexPair("USD/CAD", "US Dollar / Canadian Dollar"),
  "NZD/USD": forexPair("NZD/USD", "New Zealand Dollar / US Dollar"),

  // ================= FOREX CROSSES =================
  "EUR/GBP": forexPair("EUR/GBP", "Euro / British Pound"),
  "EUR/JPY": forexPair("EUR/JPY", "Euro / Japanese Yen"),
  "GBP/JPY": forexPair("GBP/JPY", "British Pound / Japanese Yen"),
  "AUD/CAD": forexPair("AUD/CAD", "Australian Dollar / Canadian Dollar"),
  "AUD/CHF": forexPair("AUD/CHF", "Australian Dollar / Swiss Franc"),
  "AUD/JPY": forexPair("AUD/JPY", "Australian Dollar / Japanese Yen"),
  "AUD/NZD": forexPair("AUD/NZD", "Australian Dollar / New Zealand Dollar"),
  "CAD/CHF": forexPair("CAD/CHF", "Canadian Dollar / Swiss Franc"),
  "CAD/JPY": forexPair("CAD/JPY", "Canadian Dollar / Japanese Yen"),
  "CHF/JPY": forexPair("CHF/JPY", "Swiss Franc / Japanese Yen"),
  "EUR/AUD": forexPair("EUR/AUD", "Euro / Australian Dollar"),
  "EUR/CAD": forexPair("EUR/CAD", "Euro / Canadian Dollar"),
  "EUR/CHF": forexPair("EUR/CHF", "Euro / Swiss Franc"),
  "EUR/NZD": forexPair("EUR/NZD", "Euro / New Zealand Dollar"),
  "GBP/AUD": forexPair("GBP/AUD", "British Pound / Australian Dollar"),
  "GBP/CAD": forexPair("GBP/CAD", "British Pound / Canadian Dollar"),
  "GBP/CHF": forexPair("GBP/CHF", "British Pound / Swiss Franc"),
  "GBP/NZD": forexPair("GBP/NZD", "British Pound / New Zealand Dollar"),
  "NZD/CAD": forexPair("NZD/CAD", "New Zealand Dollar / Canadian Dollar"),
  "NZD/CHF": forexPair("NZD/CHF", "New Zealand Dollar / Swiss Franc"),
  "NZD/JPY": forexPair("NZD/JPY", "New Zealand Dollar / Japanese Yen"),

  // ================= CRYPTO CFDs =================
  "BTC/USD": cryptoCfd("BTC/USD", "Bitcoin / US Dollar"),
  "ETH/USD": cryptoCfd("ETH/USD", "Ethereum / US Dollar"),
  "SOL/USD": cryptoCfd("SOL/USD", "Solana / US Dollar"),
  "XRP/USD": cryptoCfd("XRP/USD", "XRP / US Dollar"),
  "ADA/USD": cryptoCfd("ADA/USD", "Cardano / US Dollar"),

  // ================= METAL CFDs =================
  "XAU/USD": {
    symbol: "XAU/USD",
    displayName: "Gold / US Dollar",
    assetClass: "metal",
    tickSize: 0.01,
    tickValueInProfitCurrency: 1,
    pipSize: 0.1,
    quoteDigits: 2,
    contractSize: 100,
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    baseCurrency: "XAU",
    quoteCurrency: "USD",
    profitCurrency: "USD",
    brokerSpecific: true,
  },
  "XAG/USD": {
    symbol: "XAG/USD",
    displayName: "Silver / US Dollar",
    assetClass: "metal",
    tickSize: 0.01,
    tickValueInProfitCurrency: 50,
    pipSize: 0.01,
    quoteDigits: 3,
    contractSize: 5000,
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    baseCurrency: "XAG",
    quoteCurrency: "USD",
    profitCurrency: "USD",
    brokerSpecific: true,
  },
  "XPT/USD": {
    symbol: "XPT/USD",
    displayName: "Platinum / US Dollar",
    assetClass: "metal",
    tickSize: 1,
    tickValueInProfitCurrency: 50,
    pipSize: 1,
    contractSize: 50,
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    baseCurrency: "XPT",
    quoteCurrency: "USD",
    profitCurrency: "USD",
    brokerSpecific: true,
  },
  "XCU/USD": {
    symbol: "XCU/USD",
    displayName: "Copper / US Dollar",
    assetClass: "metal",
    tickSize: 0.01,
    tickValueInProfitCurrency: 25,
    pipSize: 0.01,
    contractSize: 2500,
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    baseCurrency: "XCU",
    quoteCurrency: "USD",
    profitCurrency: "USD",
    brokerSpecific: true,
  },

  // ================= INDEX CFDs =================
  US30: indexCfd("US30", "Dow Jones 30"),
  US100: indexCfd("US100", "Nasdaq 100"),
  US500: indexCfd("US500", "S&P 500"),
  DE40: indexCfd("DE40", "Germany 40 / DAX"),
  UK100: indexCfd("UK100", "UK 100 / FTSE 100"),
  JP225: indexCfd("JP225", "Japan 225 / Nikkei"),

  // ================= ENERGY / COMMODITY CFDs =================
  "WTI/USD": commodityCfd("WTI/USD", "WTI Crude Oil / US Dollar"),
  "BRENT/USD": commodityCfd("BRENT/USD", "Brent Crude Oil / US Dollar"),
  "NATGAS/USD": commodityCfd("NATGAS/USD", "Natural Gas / US Dollar", {
    tickSize: 0.001,
    tickValueInProfitCurrency: 10,
    pipSize: 0.001,
    quoteDigits: 3,
    contractSize: 10_000,
  }),
  "SOYBEAN/USD": commodityCfd("SOYBEAN/USD", "Soybeans / US Dollar", {
    tickSize: 0.25,
    tickValueInProfitCurrency: 12.5,
    pipSize: 0.25,
    quoteDigits: 2,
    contractSize: 50,
  }),
  "IRON/USD": commodityCfd("IRON/USD", "Iron Ore / US Dollar", {
    tickSize: 0.01,
    tickValueInProfitCurrency: 1,
    pipSize: 0.01,
    contractSize: 100,
  }),
};

export const CANONICAL_INSTRUMENT_SYMBOLS = Object.freeze(
  Object.keys(INSTRUMENT_CATALOG),
);

export const FOREX_SYMBOLS = Object.freeze(
  Object.values(INSTRUMENT_CATALOG)
    .filter((entry) => entry.assetClass === "forex")
    .map((entry) => entry.symbol),
);

/** Alternate broker / marketing names → canonical catalogue symbol. */
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

export function normalizeInstrumentToken(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export const SUPPORTED_INSTRUMENT_TOKENS = Object.freeze(
  Array.from(
    new Set([
      ...CANONICAL_INSTRUMENT_SYMBOLS.map(normalizeInstrumentToken),
      ...Object.keys(SYMBOL_ALIASES).map(normalizeInstrumentToken),
    ]),
  ),
);

export function normalizeInstrumentSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function resolveCatalogSymbol(symbol: string): string {
  const normalized = normalizeInstrumentSymbol(symbol);
  return SYMBOL_ALIASES[normalized] ?? normalized;
}
