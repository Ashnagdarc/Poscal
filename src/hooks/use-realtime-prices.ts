import { useCallback, useEffect, useRef, useState } from "react";

import { INTERVALS } from "@/lib/constants";
import { fetchFallbackMarketPrices } from "@/lib/marketDataFallback";

interface UseRealtimePricesOptions {
  symbols: string[];
  enabled?: boolean;
  pollIntervalMs?: number;
  staleAfterMs?: number;
  allowFallback?: boolean;
}

interface UseRealtimePricesResult {
  prices: Record<string, number>;
  askPrices: Record<string, number>;
  bidPrices: Record<string, number>;
  quoteSourceBySymbol: Record<string, string | null>;
  priceStatus: Record<string, "fresh" | "stale" | "unavailable">;
  updatedAtBySymbol: Record<string, Date | null>;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refreshPrices: () => Promise<void>;
}

export const PRICE_STALE_AFTER_MS = INTERVALS.LIVE_PRICE_REFRESH * 3;

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "number" || typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
};

const getPriceStatus = (
  hasPrice: boolean,
  timestamp: Date | null,
  staleAfterMs: number,
): "fresh" | "stale" | "unavailable" => {
  if (!hasPrice) {
    return "unavailable";
  }

  if (!timestamp) {
    return "stale";
  }

  return Date.now() - timestamp.getTime() > staleAfterMs ? "stale" : "fresh";
};

export const useRealtimePrices = ({
  symbols,
  enabled = true,
  pollIntervalMs = INTERVALS.LIVE_PRICE_REFRESH,
  staleAfterMs,
  allowFallback = true,
}: UseRealtimePricesOptions): UseRealtimePricesResult => {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [askPrices, setAskPrices] = useState<Record<string, number>>({});
  const [bidPrices, setBidPrices] = useState<Record<string, number>>({});
  const [quoteSourceBySymbol, setQuoteSourceBySymbol] = useState<Record<string, string | null>>({});
  const [priceStatus, setPriceStatus] = useState<Record<string, "fresh" | "stale" | "unavailable">>({});
  const [updatedAtBySymbol, setUpdatedAtBySymbol] = useState<Record<string, Date | null>>({});
  const [loading, setLoading] = useState(enabled && symbols.length > 0);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const pendingRequest = useRef(false);
  const pollTimer = useRef<number | null>(null);
  const isActive = useRef(true);
  const effectiveStaleAfterMs = staleAfterMs ?? Math.max(pollIntervalMs * 3, PRICE_STALE_AFTER_MS);

  const clearPollTimer = () => {
    if (pollTimer.current !== null) {
      window.clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  };

  const markUnavailable = useCallback(() => {
    setPrices({});
    setAskPrices({});
    setBidPrices({});
    setQuoteSourceBySymbol(Object.fromEntries(symbols.map((symbol) => [symbol, null])));
    setPriceStatus(Object.fromEntries(symbols.map((symbol) => [symbol, "unavailable" as const])));
    setUpdatedAtBySymbol(Object.fromEntries(symbols.map((symbol) => [symbol, null])));
    setLastUpdated(null);
  }, [symbols]);

  const refreshPrices = useCallback(async () => {
    if (!enabled || symbols.length === 0 || pendingRequest.current) {
      if (isActive.current) {
        setLoading(false);
      }
      return;
    }

    pendingRequest.current = true;
    if (isActive.current) {
      setLoading(true);
      setError(null);
    }

    try {
      if (!allowFallback) {
        markUnavailable();
        return;
      }

      const fallbackData = await fetchFallbackMarketPrices(symbols);
      const nextUpdatedAt = Object.fromEntries(
        symbols.map((symbol) => [symbol, toDate(fallbackData.timestamps[symbol])]),
      );
      const nextStatus = Object.fromEntries(
        symbols.map((symbol) => {
          const timestamp = nextUpdatedAt[symbol];
          const hasPrice = typeof fallbackData.prices[symbol] === "number";
          return [symbol, getPriceStatus(hasPrice, timestamp, effectiveStaleAfterMs)];
        }),
      );

      if (!isActive.current) {
        return;
      }

      setPrices(fallbackData.prices);
      setAskPrices(fallbackData.askPrices);
      setBidPrices(fallbackData.bidPrices);
      setQuoteSourceBySymbol(
        Object.fromEntries(
          symbols.map((symbol) => [
            symbol,
            typeof fallbackData.prices[symbol] === "number" ? "public_market_data" : null,
          ]),
        ),
      );
      setUpdatedAtBySymbol(nextUpdatedAt);
      setPriceStatus(nextStatus);

      const freshestTimestamp = Object.values(nextUpdatedAt)
        .filter((value): value is Date => value instanceof Date)
        .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
      setLastUpdated(freshestTimestamp);
    } catch (caughtError) {
      if (!isActive.current) {
        return;
      }

      markUnavailable();
      setError(caughtError instanceof Error ? caughtError.message : "Could not load market data.");
    } finally {
      pendingRequest.current = false;
      if (isActive.current) {
        setLoading(false);
      }
    }
  }, [allowFallback, effectiveStaleAfterMs, enabled, markUnavailable, symbols]);

  useEffect(() => {
    isActive.current = true;
    clearPollTimer();

    if (!enabled || symbols.length === 0) {
      markUnavailable();
      setLoading(false);
      return;
    }

    void refreshPrices();

    if (pollIntervalMs <= 0) {
      return () => {
        isActive.current = false;
        clearPollTimer();
      };
    }

    pollTimer.current = window.setTimeout(function scheduleNextRefresh() {
      void refreshPrices().finally(() => {
        if (!isActive.current) {
          return;
        }

        pollTimer.current = window.setTimeout(scheduleNextRefresh, pollIntervalMs);
      });
    }, pollIntervalMs);

    return () => {
      isActive.current = false;
      clearPollTimer();
    };
  }, [enabled, markUnavailable, pollIntervalMs, refreshPrices, symbols.length]);

  return {
    prices,
    askPrices,
    bidPrices,
    quoteSourceBySymbol,
    priceStatus,
    updatedAtBySymbol,
    loading,
    error,
    lastUpdated,
    refreshPrices,
  };
};
