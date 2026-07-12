import { findInstrument } from "./instruments";
import type { BrokerProfile, ResolvedInstrument } from "./types";

export const BROKER_PROFILES: BrokerProfile[] = [
  {
    id: "paper",
    name: "Paper",
    accountCurrency: "USD",
  },
  {
    id: "generic-forex",
    name: "Generic Forex",
    accountCurrency: "USD",
  },
  {
    id: "generic-cfd",
    name: "Generic CFD",
    accountCurrency: "USD",
    instrumentOverrides: {
      "XAU/USD": { minLot: 0.1, lotStep: 0.1 },
      "US30/USD": { minLot: 1, lotStep: 1 },
      "US100/USD": { minLot: 1, lotStep: 1 },
      "SPX/USD": { minLot: 1, lotStep: 1 },
    },
  },
];

const brokerById = new Map(BROKER_PROFILES.map((broker) => [broker.id, broker]));

export function findBrokerProfile(brokerId: string): BrokerProfile | undefined {
  return brokerById.get(brokerId);
}

export function resolveInstrumentForBroker(broker: BrokerProfile, symbol: string): ResolvedInstrument {
  const instrument = findInstrument(symbol);

  if (!instrument) {
    throw new Error(`Unsupported instrument: ${symbol}`);
  }

  const override = broker.instrumentOverrides?.[instrument.symbol];

  return {
    ...instrument,
    brokerId: broker.id,
    brokerSymbol: override?.brokerSymbol ?? instrument.symbol,
    contractSize: override?.contractSize ?? instrument.contractSize,
    minLot: override?.minLot ?? instrument.minLot,
    lotStep: override?.lotStep ?? instrument.lotStep,
    maxLot: override?.maxLot ?? instrument.maxLot,
  };
}
