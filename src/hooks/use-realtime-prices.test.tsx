import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PRICE_STALE_AFTER_MS, useRealtimePrices } from './use-realtime-prices';

describe('useRealtimePrices', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-13T10:00:00.000Z').getTime());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches prices from the backend cache endpoint only', async () => {
    const symbols = ['BTC/USD'];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(
        JSON.stringify([
          {
            symbol: 'BTC/USD',
            mid_price: 68000,
            ask_price: 68004,
            bid_price: 67996,
            source: 'finnhub',
            timestamp: '2026-04-13T09:59:45.000Z',
          },
        ]),
        { status: 200 },
      ),
    );

    const { result } = renderHook(() =>
      useRealtimePrices({ symbols, enabled: true }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchSpy).toHaveBeenCalledWith('/api/prices/multiple?symbols=BTC%2FUSD');
    expect(result.current.prices['BTC/USD']).toBe(68000);
    expect(result.current.priceStatus['BTC/USD']).toBe('fresh');
    expect(result.current.quoteSourceBySymbol['BTC/USD']).toBe('finnhub');
  });

  it('marks old cached quotes as stale', async () => {
    const symbols = ['EUR/USD'];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(
        JSON.stringify([
          {
            symbol: 'EUR/USD',
            mid_price: '1.09',
            ask_price: '1.09005',
            bid_price: '1.08995',
            timestamp: Date.now() - PRICE_STALE_AFTER_MS - 1000,
          },
        ]),
        { status: 200 },
      ),
    );

    const { result } = renderHook(() =>
      useRealtimePrices({ symbols, enabled: true }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.priceStatus['EUR/USD']).toBe('stale');
  });

  it('falls back to public market data when backend has no symbol', async () => {
    const symbols = ['USD/JPY'];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (input === '/api/prices/multiple?symbols=USD%2FJPY') {
        return new Response(JSON.stringify([]), { status: 200 });
      }

      if (input === 'https://open.er-api.com/v6/latest/USD') {
        return new Response(
          JSON.stringify({
            rates: {
              JPY: 157,
            },
          }),
          { status: 200 },
        );
      }

      throw new Error(`Unexpected fetch: ${String(input)}`);
    });

    const { result } = renderHook(() =>
      useRealtimePrices({ symbols, enabled: true }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchSpy).toHaveBeenCalledWith('https://open.er-api.com/v6/latest/USD');
    expect(result.current.priceStatus['USD/JPY']).toBe('fresh');
    expect(result.current.prices['USD/JPY']).toBe(157);
  });

  it('does not fall back to public market data when fallback is disabled', async () => {
    const symbols = ['USD/JPY'];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (input === '/api/prices/multiple?symbols=USD%2FJPY') {
        return new Response(JSON.stringify([]), { status: 200 });
      }

      throw new Error(`Unexpected fetch: ${String(input)}`);
    });

    const { result } = renderHook(() =>
      useRealtimePrices({ symbols, enabled: true, allowFallback: false }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchSpy).not.toHaveBeenCalledWith('https://open.er-api.com/v6/latest/USD');
    expect(result.current.priceStatus['USD/JPY']).toBe('unavailable');
    expect(result.current.prices['USD/JPY']).toBeUndefined();
  });
});
