// This is a TypeScript type definition for price updates
export type PriceUpdate = {
  type: 'update';
  symbol: string;
  mid_price: number;
  ask_price: number;
  bid_price: number;
  timestamp: string;
};

export type InitPrices = {
  type: 'init';
  prices: Record<string, {
    mid_price: number;
    ask_price: number;
    bid_price: number;
    timestamp: string;
  }>;
};
