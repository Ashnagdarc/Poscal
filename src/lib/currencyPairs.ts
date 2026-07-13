import { listSupportedInstruments } from "@/domain/instruments";

export interface CurrencyPair {
  symbol: string;
  pipDecimal: number;
}

export const CURRENCY_PAIRS: CurrencyPair[] = listSupportedInstruments().map((instrument) => ({
  symbol: instrument.symbol,
  pipDecimal: instrument.pipPrecision,
}));
