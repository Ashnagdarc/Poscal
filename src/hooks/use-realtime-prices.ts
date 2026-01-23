import { useState, useEffect, useCallback, useRef } from 'react';

// Type definition for realtime channel (replaces Supabase import)
type RealtimeChannel = any;

interface PriceData {
  symbol: string;
  bid_price: number;
  ask_price: number;
  mid_price: number;
  timestamp: string;
}

interface UseRealtimePricesOptions {
  symbols: string[];
  enabled?: boolean; 
}

interface UseRealtimePricesResult {
  prices: Record<string, number>;
  askPrices: Record<string, number>;
  bidPrices: Record<string, number>;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refreshPrices: () => Promise<void>;
}

/**
 * Hook for real-time price updates via Supabase Realtime
 * Backend (push-sender) fetches prices every 10 seconds from Twelve Data API
 * All users listen via Realtime - single source of truth
 * 
 * Reduces API calls from 360,000/hour (1000 users @ 10sec) to 360/hour
 * - 1000x reduction in API costs
 * - Accurate prices for all users simultaneously
 * - Scalable to unlimited users
 */
export const useRealtimePrices = ({
  symbols,
  enabled = true,
}: UseRealtimePricesOptions): UseRealtimePricesResult => {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [askPrices, setAskPrices] = useState<Record<string, number>>({});
  const [bidPrices, setBidPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const pollTimer = useRef<number | null>(null);
  const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || '';
  const wsUrl = (import.meta as any).env?.VITE_WS_URL || '';

  // Fetch initial prices from backend REST API (NestJS)
  const fetchInitialPrices = useCallback(async () => {
    if (!enabled || symbols.length === 0) {
      setLoading(false);
      return;
    }

    try {
      const query = encodeURIComponent(symbols.join(','));
      const res = await fetch(`${apiBase}/prices?symbols=${query}`);
      if (!res.ok) {
        throw new Error(`API error ${res.status}`);
      }
      const data = await res.json();
      if (!data || data.length === 0) {
        console.warn('⚠️  No prices returned yet - waiting for backend updates...');
        setLoading(false);
        return;
      }

      const newPrices: Record<string, number> = {};
      const newAskPrices: Record<string, number> = {};
      const newBidPrices: Record<string, number> = {};

      data.forEach((item: any) => {
        // Support both snake_case and camelCase from backend
        const symbol = item.symbol;
        const mid = item.mid_price ?? item.midPrice ?? item.price ?? item.last;
        const ask = item.ask_price ?? item.askPrice ?? item.ask;
        const bid = item.bid_price ?? item.bidPrice ?? item.bid;
        const ts = item.timestamp ?? item.updated_at ?? item.updatedAt ?? new Date().toISOString();

        if (typeof mid === 'number') newPrices[symbol] = mid;
        if (typeof ask === 'number') newAskPrices[symbol] = ask;
        if (typeof bid === 'number') newBidPrices[symbol] = bid;
        setLastUpdated(new Date(ts));
      });

      setPrices(newPrices);
      setAskPrices(newAskPrices);
      setBidPrices(newBidPrices);
      setError(null);
      setLoading(false);
    } catch (err) {
      console.error('❌ Error in fetchInitialPrices:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch prices');
      setLoading(false);
    }
  }, [enabled, symbols]);

  // Setup polling (temporary) and optional WS hookup if available
  useEffect(() => {
    if (!enabled || symbols.length === 0) {
      setLoading(false);
      return;
    }

    console.log('🔄 Starting price polling for symbols:', symbols);
    fetchInitialPrices();

    // Simple polling every 2s while WebSocket gateway is being migrated
    pollTimer.current = window.setInterval(() => {
      fetchInitialPrices();
    }, 2000);

    return () => {
      if (pollTimer.current) {
        window.clearInterval(pollTimer.current);
        pollTimer.current = null;
        console.log('🧹 Stopped price polling for:', symbols);
      }
    };
  }, [enabled, symbols, fetchInitialPrices]);

  return {
    prices,
    askPrices,
    bidPrices,
    loading,
    error,
    lastUpdated,
    refreshPrices: fetchInitialPrices,
  };
};
