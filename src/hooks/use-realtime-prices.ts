import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

  // Fetch initial prices from price_cache table
  const fetchInitialPrices = useCallback(async () => {
    if (!enabled || symbols.length === 0) {
      setLoading(false);
      return;
    }

    try {
      const { data, error: err } = await supabase
        .from('price_cache')
        .select('symbol, mid_price, ask_price, bid_price, timestamp')
        .in('symbol', symbols);

      if (err) {
        console.warn('⚠️  Error fetching prices from cache:', err);
        setError(err.message);
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        console.warn('⚠️  No prices in cache yet - waiting for push-sender to fetch...');
        setLoading(false);
        return;
      }

      const newPrices: Record<string, number> = {};
      const newAskPrices: Record<string, number> = {};
      const newBidPrices: Record<string, number> = {};

      data.forEach((item: any) => {
        newPrices[item.symbol] = item.mid_price;
        newAskPrices[item.symbol] = item.ask_price;
        newBidPrices[item.symbol] = item.bid_price;
      });

      setPrices(newPrices);
      setAskPrices(newAskPrices);
      setBidPrices(newBidPrices);
      setLastUpdated(new Date(data[0].timestamp));
      setError(null);
      setLoading(false);
    } catch (err) {
      console.error('❌ Error in fetchInitialPrices:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch prices');
      setLoading(false);
    }
  }, [enabled, symbols]);

  // Setup Realtime subscription
  useEffect(() => {
    if (!enabled || symbols.length === 0) {
      setLoading(false);
      return;
    }

    console.log('🔄 Setting up subscription for symbols:', symbols);
    fetchInitialPrices();

    let channel: RealtimeChannel | null = null;

    try {
      // Create unique channel name to prevent conflicts between multiple components
      const channelName = `price-updates-${symbols.sort().join('-')}`;
      
      // Subscribe to price_cache updates from push-sender
      channel = supabase
        .channel(channelName, {
          config: {
            broadcast: { self: true }
          }
        })
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'price_cache',
            filter: `symbol=in.(${symbols.map((s) => `"${s}"`).join(',')})`
          },
          (payload) => {
            const { symbol, mid_price, ask_price, bid_price, timestamp } = payload.new;
            
            setPrices((prev) => ({
              ...prev,
              [symbol]: mid_price,
            }));

            setAskPrices((prev) => ({
              ...prev,
              [symbol]: ask_price,
            }));

            setBidPrices((prev) => ({
              ...prev,
              [symbol]: bid_price,
            }));

            setLastUpdated(new Date(timestamp));
            setError(null);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'price_cache',
            filter: `symbol=in.(${symbols.map((s) => `"${s}"`).join(',')})`
          },
          (payload) => {
            const { symbol, mid_price, ask_price, bid_price, timestamp } = payload.new;
            
            setPrices((prev) => ({
              ...prev,
              [symbol]: mid_price,
            }));

            setAskPrices((prev) => ({
              ...prev,
              [symbol]: ask_price,
            }));

            setBidPrices((prev) => ({
              ...prev,
              [symbol]: bid_price,
            }));

            setLastUpdated(new Date(timestamp));
            setError(null);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Subscribed to real-time price updates');
          } else if (status === 'CHANNEL_ERROR') {
            setError('Failed to subscribe to price updates');
            console.error('❌ Realtime channel error - connection may be unstable');
          } else if (status === 'CLOSED') {
            console.warn('⚠️  Realtime channel closed');
          }
        });
    } catch (err) {
      console.error('❌ Error setting up Realtime subscription:', err);
      setError(err instanceof Error ? err.message : 'Failed to setup subscription');
    }

    return () => {
      if (channel) {
        console.log('🧹 Cleaning up subscription for:', symbols);
        supabase.removeChannel(channel);
      }
    };
  }, [enabled, symbols]);

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
