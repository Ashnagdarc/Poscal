import { useQuery } from "@tanstack/react-query";
import {
  fetchForexMidPrices,
  pickMarketPrices,
  type ForexMidPrices,
} from "@/lib/forexRateService";

const STALE_MS = 5 * 60 * 1000;

/**
 * Auto-loads mid FX rates used for cross-pair and non-USD account sizing.
 * Manual overrides in the calculator still win when the user types a rate.
 */
export function useAutoMarketPrices(
  symbols: Array<string | null | undefined>,
): {
  prices: ForexMidPrices | null;
  isLoading: boolean;
  isError: boolean;
  allPrices: ForexMidPrices | null;
} {
  const needed = symbols.filter((s): s is string => Boolean(s));
  const enabled = needed.length > 0;

  const query = useQuery({
    queryKey: ["forex-mid-prices"],
    queryFn: () => fetchForexMidPrices(),
    enabled,
    staleTime: STALE_MS,
    gcTime: 30 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
  });

  const allPrices = query.data ?? null;

  return {
    prices: enabled ? pickMarketPrices(allPrices, needed) : null,
    allPrices,
    isLoading: enabled && query.isLoading,
    isError: enabled && query.isError,
  };
}
