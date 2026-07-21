export type AssetClass = "forex" | "metal" | "crypto" | "index";

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

export const INSTRUMENT_SPECS: Record<string, InstrumentSpec> = {
  "EUR/USD": {
    symbol: "EUR/USD",
    displayName: "Euro / US Dollar",
    assetClass: "forex",
    pipSize: 0.0001,
    pipValuePerStandardLot: 10,
    contractSize: 100000,
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    brokerSpecific: false,
  },
  "GBP/USD": {
    symbol: "GBP/USD",
    displayName: "British Pound / US Dollar",
    assetClass: "forex",
    pipSize: 0.0001,
    pipValuePerStandardLot: 10,
    contractSize: 100000,
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    brokerSpecific: false,
  },
  "USD/JPY": {
    symbol: "USD/JPY",
    displayName: "US Dollar / Japanese Yen",
    assetClass: "forex",
    pipSize: 0.01,
    pipValuePerStandardLot: 6.15,
    contractSize: 100000,
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    brokerSpecific: false,
  },
  "USD/CHF": {
    symbol: "USD/CHF",
    displayName: "US Dollar / Swiss Franc",
    assetClass: "forex",
    pipSize: 0.0001,
    pipValuePerStandardLot: 11.3,
    contractSize: 100000,
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    brokerSpecific: false,
  },
  "AUD/USD": {
    symbol: "AUD/USD",
    displayName: "Australian Dollar / US Dollar",
    assetClass: "forex",
    pipSize: 0.0001,
    pipValuePerStandardLot: 10,
    contractSize: 100000,
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    brokerSpecific: false,
  },
  "USD/CAD": {
    symbol: "USD/CAD",
    displayName: "US Dollar / Canadian Dollar",
    assetClass: "forex",
    pipSize: 0.0001,
    pipValuePerStandardLot: 7.38,
    contractSize: 100000,
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    brokerSpecific: false,
  },
  "NZD/USD": {
    symbol: "NZD/USD",
    displayName: "New Zealand Dollar / US Dollar",
    assetClass: "forex",
    pipSize: 0.0001,
    pipValuePerStandardLot: 10,
    contractSize: 100000,
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    brokerSpecific: false,
  },
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
    warning: BROKER_SPECIFIC_WARNING,
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
  "BTC/USD": {
    symbol: "BTC/USD",
    displayName: "Bitcoin / US Dollar",
    assetClass: "crypto",
    pipSize: 1,
    pipValuePerStandardLot: 1,
    contractSize: 1,
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    brokerSpecific: true,
    warning: BROKER_SPECIFIC_WARNING,
  },
  "ETH/USD": {
    symbol: "ETH/USD",
    displayName: "Ethereum / US Dollar",
    assetClass: "crypto",
    pipSize: 1,
    pipValuePerStandardLot: 1,
    contractSize: 1,
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    brokerSpecific: true,
    warning: BROKER_SPECIFIC_WARNING,
  },
  US30: {
    symbol: "US30",
    displayName: "Dow Jones 30",
    assetClass: "index",
    pipSize: 1,
    pipValuePerStandardLot: 1,
    contractSize: 1,
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    brokerSpecific: true,
    warning: BROKER_SPECIFIC_WARNING,
  },
  US100: {
    symbol: "US100",
    displayName: "Nasdaq 100",
    assetClass: "index",
    pipSize: 1,
    pipValuePerStandardLot: 1,
    contractSize: 1,
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    brokerSpecific: true,
    warning: BROKER_SPECIFIC_WARNING,
  },
  US500: {
    symbol: "US500",
    displayName: "S&P 500",
    assetClass: "index",
    pipSize: 1,
    pipValuePerStandardLot: 1,
    contractSize: 1,
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    brokerSpecific: true,
    warning: BROKER_SPECIFIC_WARNING,
  },
};

export function normalizeInstrumentSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function getInstrumentSpecBySymbol(symbol: string): InstrumentSpec | undefined {
  return INSTRUMENT_SPECS[normalizeInstrumentSymbol(symbol)];
}

/** Label for stop-distance input — gold, silver, indices, and crypto use "points". */
export function getStopLossUnitLabel(symbol: string): string {
  const spec = getInstrumentSpecBySymbol(symbol);
  if (!spec) return "pips";
  if (spec.assetClass === "metal" || spec.assetClass === "index" || spec.assetClass === "crypto") {
    return "pts";
  }
  return "pips";
}

