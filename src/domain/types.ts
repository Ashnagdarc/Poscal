export type InstrumentKind = "forex" | "metal" | "crypto" | "index";
export type OrderType = "market" | "limit";
export type TradeSide = "buy" | "sell";

export interface InstrumentSpec {
  symbol: string;
  name: string;
  kind: InstrumentKind;
  baseCurrency: string;
  quoteCurrency: string;
  pricePrecision: number;
  pipPrecision: number;
  pipSize: number;
  contractSize: number;
  minLot: number;
  lotStep: number;
  maxLot?: number;
}

export interface BrokerInstrumentOverride {
  brokerSymbol?: string;
  contractSize?: number;
  minLot?: number;
  lotStep?: number;
  maxLot?: number;
}

export interface BrokerProfile {
  id: string;
  name: string;
  accountCurrency: string;
  instrumentOverrides?: Record<string, BrokerInstrumentOverride>;
}

export interface ResolvedInstrument extends InstrumentSpec {
  brokerId: string;
  brokerSymbol: string;
}

export interface MarketQuote {
  bid?: number;
  ask?: number;
  mid?: number;
}

export interface PositionSizeInput {
  broker: BrokerProfile;
  instrument: ResolvedInstrument;
  accountBalance: number;
  riskPercent: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  side: TradeSide;
  orderType?: OrderType;
  entryPrice?: number;
  marketQuote?: MarketQuote;
  conversionRates?: Record<string, number>;
}

export interface PositionSizeResult {
  entryPrice: number;
  stopDistancePrice: number;
  stopDistancePips: number;
  rewardDistancePrice: number;
  rewardDistancePips: number;
  riskAmount: number;
  riskPerLot: number;
  rawLots: number;
  lots: number;
  units: number;
  pipValueInAccountCurrency: number;
  notionalValue: number;
  actualRiskAmount: number;
  actualRiskPercent: number;
  rewardRiskRatio: number;
  isBelowMinimumLot: boolean;
}
