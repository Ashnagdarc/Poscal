import { useState, useEffect, useCallback, useRef } from 'react';
import { INTERVALS } from '@/lib/constants';

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
  pollIntervalMs?: number;
  staleAfterMs?: number;
}

interface UseRealtimePricesResult {
  prices: Record<string, number>;
  askPrices: Record<string, number>;
  bidPrices: Record<string, number>;
  priceStatus: Record<string, 'fresh' | 'stale' | 'unavailable'>;
  updatedAtBySymbol: Record<string, Date | null>;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refreshPrices: () => Promise<void>;
}

export const PRICE_STALE_AFTER_MS = INTERVALS.LIVE_PRICE_REFRESH * 3;

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      const date = new Date(numeric);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
};

const getPriceStatus = (
  hasPrice: boolean,
  timestamp: Date | null,
  staleAfterMs: number,
): 'fresh' | 'stale' | 'unavailable' => {
  if (!hasPrice) {
    return 'unavailable';
  }

  if (!timestamp) {
    return 'stale';
  }

  return Date.now() - timestamp.getTime() > staleAfterMs ? 'stale' : 'fresh';
};

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
  pollIntervalMs = INTERVALS.LIVE_PRICE_REFRESH,
  staleAfterMs,
}: UseRealtimePricesOptions): UseRealtimePricesResult => {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [askPrices, setAskPrices] = useState<Record<string, number>>({});
  const [bidPrices, setBidPrices] = useState<Record<string, number>>({});
  const [priceStatus, setPriceStatus] = useState<Record<string, 'fresh' | 'stale' | 'unavailable'>>({});
  const [updatedAtBySymbol, setUpdatedAtBySymbol] = useState<Record<string, Date | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const pollTimer = useRef<number | null>(null);
  const pendingRequest = useRef<boolean>(false); // Prevent duplicate requests
  const effectiveStaleAfterMs = staleAfterMs ?? Math.max(pollIntervalMs * 3, INTERVALS.LIVE_PRICE_REFRESH);
  // Use relative API path so Vercel proxy handles HTTPS securely
  const apiBase = '/api';

  // Fetch initial prices from backend REST API (NestJS)
  const fetchInitialPrices = useCallback(async () => {
    if (!enabled || symbols.length === 0) {
      setLoading(false);
      return;
    }

    // Prevent duplicate simultaneous requests
    if (pendingRequest.current) {
      console.log('⏭️  Skipping fetch - request already in progress');
      return;
    }

    try {
      pendingRequest.current = true;
      const query = encodeURIComponent(symbols.join(','));
      const res = await fetch(`${apiBase}/prices/multiple?symbols=${query}`);
      if (!res.ok) {
        throw new Error(`API error ${res.status}`);
      }
      const data = await res.json();
      if (!data || data.length === 0) {
        console.warn('⚠️  No prices returned yet - waiting for backend updates...');
        const unavailableStatus = Object.fromEntries(
          symbols.map((symbol) => [symbol, 'unavailable' as const]),
        );
        const missingUpdatedAt = Object.fromEntries(
          symbols.map((symbol) => [symbol, null]),
        );
        setPrices({});
        setAskPrices({});
        setBidPrices({});
        setPriceStatus(unavailableStatus);
        setUpdatedAtBySymbol(missingUpdatedAt);
        setLastUpdated(null);
        setLoading(false);
        return;
      }

      const newPrices: Record<string, number> = {};
      const newAskPrices: Record<string, number> = {};
      const newBidPrices: Record<string, number> = {};
      const newPriceStatus: Record<string, 'fresh' | 'stale' | 'unavailable'> = {};
      const newUpdatedAtBySymbol: Record<string, Date | null> = {};
      let newestTimestamp: Date | null = null;

      data.forEach((item: any) => {
        // Support both snake_case and camelCase from backend
        const symbol = item.symbol;
        const mid = toNumber(item.mid_price ?? item.midPrice ?? item.price ?? item.last);
        const ask = toNumber(item.ask_price ?? item.askPrice ?? item.ask);
        const bid = toNumber(item.bid_price ?? item.bidPrice ?? item.bid);
        const ts = item.timestamp ?? item.updated_at ?? item.updatedAt ?? new Date().toISOString();
        const parsedTimestamp = toDate(ts);

        if (typeof mid === 'number') newPrices[symbol] = mid;
        if (typeof ask === 'number') newAskPrices[symbol] = ask;
        if (typeof bid === 'number') newBidPrices[symbol] = bid;
        const hasPrice = typeof mid === 'number' || typeof ask === 'number' || typeof bid === 'number';
        newUpdatedAtBySymbol[symbol] = parsedTimestamp;
        newPriceStatus[symbol] = getPriceStatus(hasPrice, parsedTimestamp, effectiveStaleAfterMs);

        if (parsedTimestamp) {
          if (!newestTimestamp || parsedTimestamp > newestTimestamp) {
            newestTimestamp = parsedTimestamp;
          }
        }
      });

      symbols.forEach((symbol) => {
        if (!(symbol in newPriceStatus)) {
          newPriceStatus[symbol] = 'unavailable';
          newUpdatedAtBySymbol[symbol] = null;
        }
      });

      setPrices(newPrices);
      setAskPrices(newAskPrices);
      setBidPrices(newBidPrices);
      setPriceStatus(newPriceStatus);
      setUpdatedAtBySymbol(newUpdatedAtBySymbol);
      setLastUpdated(newestTimestamp);
      setError(null);
      setLoading(false);
    } catch (err) {
      console.error('❌ Error in fetchInitialPrices:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch prices');
      setLoading(false);
    } finally {
      pendingRequest.current = false; // Always release the lock
    }
  }, [enabled, symbols, effectiveStaleAfterMs]);

  // Setup polling (temporary) and optional WS hookup if available
  useEffect(() => {
    if (!enabled || symbols.length === 0) {
      setLoading(false);
      return;
    }

    console.log('🔄 Starting price polling for symbols:', symbols);
    fetchInitialPrices();

    // Poll at the active screen cadence. The calculator uses a shorter cadence than other screens.
    pollTimer.current = window.setInterval(() => {
      fetchInitialPrices();
    }, pollIntervalMs);

    return () => {
      if (pollTimer.current) {
        window.clearInterval(pollTimer.current);
        pollTimer.current = null;
        console.log('🧹 Stopped price polling for:', symbols);
      }
    };
  }, [enabled, symbols, fetchInitialPrices, pollIntervalMs]);

  return {
    prices,
    askPrices,
    bidPrices,
    priceStatus,
    updatedAtBySymbol,
    loading,
    error,
    lastUpdated,
    refreshPrices: fetchInitialPrices,
  };
};
