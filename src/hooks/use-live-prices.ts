import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseLivePricesOptions {
  symbols: string[];
  enabled?: boolean;
  refreshInterval?: number; // in milliseconds
}

interface UseLivePricesResult {
  prices: Record<string, number>;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

export const useLivePrices = ({ 
  symbols, 
  enabled = true, 
  refreshInterval = 30000 // 30 seconds default
}: UseLivePricesOptions): UseLivePricesResult => {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchPrices = useCallback(async () => {
    if (!enabled || symbols.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('get-live-prices', {
        body: { symbols }
      });
      
      if (invokeError) {
        throw new Error(invokeError.message);
      }
      
      if (data?.prices) {
        setPrices(data.prices);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Error fetching live prices:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch prices');
    } finally {
      setLoading(false);
    }
  }, [symbols, enabled]);

  // Initial fetch
  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  // Periodic refresh
  useEffect(() => {
    if (!enabled || refreshInterval <= 0) return;
    
    const interval = setInterval(fetchPrices, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchPrices, enabled, refreshInterval]);

  return {
    prices,
    loading,
    error,
    lastUpdated,
    refresh: fetchPrices
  };
};
