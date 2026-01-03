import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface UseLivePricesOptions {
  symbols: string[];
  enabled?: boolean;
  refetchInterval?: number; // in milliseconds
}

export const LIVE_PRICES_QUERY_KEY = ['live_prices'] as const;

export const useLivePricesQuery = ({ 
  symbols, 
  enabled = true,
  refetchInterval = 30000 // 30 seconds default
}: UseLivePricesOptions) => {
  return useQuery({
    queryKey: [...LIVE_PRICES_QUERY_KEY, symbols.sort().join(',')],
    queryFn: async (): Promise<Record<string, number>> => {
      if (symbols.length === 0) return {};

      const { data, error } = await supabase.functions.invoke('get-live-prices', {
        body: { symbols }
      });

      if (error) {
        logger.error('Error fetching live prices:', error);
        throw new Error(error.message);
      }

      return data?.prices || {};
    },
    enabled: enabled && symbols.length > 0,
    staleTime: refetchInterval / 2, // Consider data stale after half the refetch interval
    gcTime: 1000 * 60, // Keep in cache for 1 minute
    refetchInterval, // Auto-refetch at specified interval
    refetchIntervalInBackground: false, // Don't refetch when tab is not visible
    retry: 2, // Retry failed requests twice
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff
  });
};
