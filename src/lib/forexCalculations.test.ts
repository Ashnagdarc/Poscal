import { describe, expect, it } from 'vitest';

import { getPipValueInUSD } from '@/lib/forexCalculations';

describe('forexCalculations', () => {
  describe('getPipValueInUSD', () => {
    it('uses the provided ask price for buy sizing on USD-base pairs', () => {
      const pipValue = getPipValueInUSD('USD/JPY', 'USD', 150.005, undefined, 'ask');

      expect(pipValue).toBeCloseTo((100000 * 0.01) / 150.005, 6);
    });

    it('uses the provided bid price for sell sizing on USD-base pairs', () => {
      const pipValue = getPipValueInUSD('USD/JPY', 'USD', 149.995, undefined, 'bid');

      expect(pipValue).toBeCloseTo((100000 * 0.01) / 149.995, 6);
    });

    it('uses the ask side of USD/JPY for JPY cross-pair conversion', () => {
      const pipValue = getPipValueInUSD(
        'GBP/JPY',
        'USD',
        undefined,
        {
          midPrices: { 'USD/JPY': 150.0 },
          askPrices: { 'USD/JPY': 150.005 },
          bidPrices: { 'USD/JPY': 149.995 },
        },
        'ask'
      );

      expect(pipValue).toBeCloseTo(1000 / 150.005, 6);
    });

    it('uses the bid side of quote/USD for cross-pair conversion', () => {
      const pipValue = getPipValueInUSD(
        'EUR/GBP',
        'USD',
        undefined,
        {
          midPrices: { 'GBP/USD': 1.25 },
          askPrices: { 'GBP/USD': 1.2502 },
          bidPrices: { 'GBP/USD': 1.2498 },
        },
        'ask'
      );

      expect(pipValue).toBeCloseTo(10 * 1.2498, 6);
    });
  });
});
