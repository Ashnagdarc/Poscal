import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mapOandaResponseToQuotes } from './oandaQuoteProvider';

describe('mapOandaResponseToQuotes', () => {
  it('parses closeoutBid and closeoutAsk and computes mid price', () => {
    const quotes = mapOandaResponseToQuotes(
      [['EUR/USD', 'OANDA:EUR_USD']],
      {
        prices: [
          {
            instrument: 'EUR_USD',
            closeoutBid: '1.08995',
            closeoutAsk: '1.09005',
            time: '2026-04-13T10:00:00.000000000Z',
            status: 'tradeable',
          },
        ],
      },
    );

    assert.equal(quotes.length, 1);
    assert.equal(quotes[0]?.symbol, 'EUR/USD');
    assert.equal(quotes[0]?.bid_price, 1.08995);
    assert.equal(quotes[0]?.ask_price, 1.09005);
    assert.ok(Math.abs((quotes[0]?.mid_price ?? 0) - 1.09) < 1e-12);
    assert.equal(quotes[0]?.source, 'oanda');
  });

  it('skips non-tradeable instruments', () => {
    const quotes = mapOandaResponseToQuotes(
      [['EUR/USD', 'OANDA:EUR_USD']],
      {
        prices: [
          {
            instrument: 'EUR_USD',
            closeoutBid: '1.08995',
            closeoutAsk: '1.09005',
            time: '2026-04-13T10:00:00.000000000Z',
            status: 'halted',
          },
        ],
      },
    );

    assert.equal(quotes.length, 0);
  });

  it('skips malformed prices cleanly', () => {
    const quotes = mapOandaResponseToQuotes(
      [['EUR/USD', 'OANDA:EUR_USD']],
      {
        prices: [
          {
            instrument: 'EUR_USD',
            closeoutBid: 'bad-value',
            closeoutAsk: '1.09005',
            time: '2026-04-13T10:00:00.000000000Z',
            status: 'tradeable',
          },
        ],
      },
    );

    assert.equal(quotes.length, 0);
  });
});
