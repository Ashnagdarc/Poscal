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
