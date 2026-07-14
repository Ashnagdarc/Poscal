import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PRICE_STALE_AFTER_MS, useRealtimePrices } from './use-realtime-prices';
import { convexClient } from '@/lib/convexClient';

vi.mock('@/lib/convexClient', async () => {
  const actual = await vi.importActual<typeof import('@/lib/convexClient')>('@/lib/convexClient');

  return {
    ...actual,
    convexClient: {
      query: vi.fn(),
    },
  };
});

describe('useRealtimePrices', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-13T10:00:00.000Z').getTime());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches prices from the backend cache endpoint only', async () => {
    const symbols = ['BTC/USD'];
    vi.mocked(convexClient.query).mockResolvedValue([
      {
        symbol: 'BTC/USD',
        mid_price: 68000,
        ask_price: 68004,
        bid_price: 67996,
        timestamp: '2026-04-13T09:59:45.000Z',
      },
    ] as never);

    const { result } = renderHook(() =>
      useRealtimePrices({ symbols, enabled: true }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(convexClient.query).toHaveBeenCalledTimes(1);
    expect(result.current.prices['BTC/USD']).toBe(68000);
    expect(result.current.priceStatus['BTC/USD']).toBe('fresh');
  });

  it('marks old cached quotes as stale', async () => {
    const symbols = ['EUR/USD'];
    vi.mocked(convexClient.query).mockResolvedValue([
      {
        symbol: 'EUR/USD',
        mid_price: '1.09',
        ask_price: '1.09005',
        bid_price: '1.08995',
        timestamp: Date.now() - PRICE_STALE_AFTER_MS - 1000,
      },
    ] as never);

    const { result } = renderHook(() =>
      useRealtimePrices({ symbols, enabled: true }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.priceStatus['EUR/USD']).toBe('stale');
  });

  it('marks missing symbols as unavailable', async () => {
    const symbols = ['USD/JPY'];
    vi.mocked(convexClient.query).mockResolvedValue([] as never);

    const { result } = renderHook(() =>
      useRealtimePrices({ symbols, enabled: true }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.priceStatus['USD/JPY']).toBe('unavailable');
    expect(result.current.prices['USD/JPY']).toBeUndefined();
  });
});
