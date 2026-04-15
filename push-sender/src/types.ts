export interface PushSubscription {
  id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  user_id: string | null;
}

export interface QueuedNotification {
  id: string;
  title: string;
  body: string;
  tag?: string | null;
  icon?: string | null;
  url?: string | null;
  data: unknown;
  created_at: string;
  user_id?: string | null;
}

export interface PriceBatchItem {
  symbol: string;
  mid_price: number;
  ask_price: number;
  bid_price: number;
  timestamp: number;
  updated_at: string;
  source?: 'finnhub' | 'oanda';
}

export interface FinnhubTradeMessage {
  type: string;
  data?: FinnhubTrade[];
}

export interface FinnhubTrade {
  s: string;
  p: number;
  t: number;
  v?: number;
}

export interface OandaPriceBucket {
  liquidity: number;
  price: string;
}

export interface OandaClientPrice {
  asks?: OandaPriceBucket[];
  bids?: OandaPriceBucket[];
  closeoutAsk?: string;
  closeoutBid?: string;
  instrument: string;
  status?: string;
  time: string;
}

export interface OandaPricingResponse {
  prices: OandaClientPrice[];
  time?: string;
}
