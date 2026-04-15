import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { partitionSymbolMappings } from '../lib/symbols';
import { normalizeFinnhubTradeMessage, PriceIngestor } from './priceIngestor';

const ORIGINAL_ENV = { ...process.env };

describe('price ingestor helpers', () => {
  it('partitions OANDA and non-OANDA symbols cleanly', () => {
    const { oanda, referenceOanda, nonOanda } = partitionSymbolMappings();

    assert.ok(oanda['EUR/USD']);
    assert.equal(oanda['XAU/USD'], undefined);
    assert.ok(referenceOanda['XAU/USD']);
    assert.ok(nonOanda['BTC/USD']);
    assert.ok(nonOanda['ETH/USD']);
    assert.equal(oanda['BTC/USD'], undefined);
    assert.equal(nonOanda['EUR/USD'], undefined);
  });

  it('normalizes Finnhub trades only for mapped non-OANDA symbols', () => {
    const reverseMap = new Map<string, string[]>([
      ['BINANCE:BTCUSDT', ['BTC/USD']],
    ]);

    const items = normalizeFinnhubTradeMessage(
      {
        type: 'trade',
        data: [
          { s: 'BINANCE:BTCUSDT', p: 68000, t: 1713000000000 },
          { s: 'OANDA:EUR_USD', p: 1.09, t: 1713000000001 },
        ],
      },
      reverseMap,
    );

    assert.equal(items.length, 1);
    assert.equal(items[0]?.symbol, 'BTC/USD');
    assert.equal(items[0]?.source, 'finnhub');
    assert.ok(items[0]?.ask_price && items[0]?.bid_price);
  });
});

describe('PriceIngestor hybrid flow', () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      PRICE_PROVIDER_MODE: 'finnhub',
      NESTJS_SERVICE_TOKEN: 'test-token',
      FINNHUB_API_KEY: 'test-finnhub-key',
      NESTJS_API_URL: 'http://localhost:3001',
      BATCH_INTERVAL: '1000',
    };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('merges forex and crypto rows from Finnhub stream into one backend batch', async () => {
    const ingestor = new PriceIngestor() as any;
    let postedPayload: any[] | undefined;

    ingestor.nestApi = {
      post: async (_url: string, payload: any[]) => {
        postedPayload = payload;
      },
    };

    ingestor.handleMessage(JSON.stringify({
      type: 'trade',
      data: [
        { s: 'BINANCE:BTCUSDT', p: 68000, t: 1713000001000 },
        { s: 'OANDA:EUR_USD', p: 1.09, t: 1713000002000 },
      ],
    }));
    await ingestor.flushBatch();

    assert.ok(postedPayload);
    assert.equal(postedPayload?.length, 2);
    assert.deepEqual(
      postedPayload?.map((item) => [item.symbol, item.source]).sort(),
      [
        ['BTC/USD', 'finnhub'],
        ['EUR/USD', 'finnhub'],
      ],
    );
    assert.ok(postedPayload?.every((item) =>
      typeof item.bid_price === 'number' &&
      typeof item.ask_price === 'number' &&
      typeof item.mid_price === 'number' &&
      typeof item.timestamp === 'number',
    ));
  });

  it('ignores unmapped stream symbols without generating synthetic rows', async () => {
    const ingestor = new PriceIngestor() as any;
    let postedPayload: any[] | undefined;

    ingestor.nestApi = {
      post: async (_url: string, payload: any[]) => {
        postedPayload = payload;
      },
    };

    ingestor.handleMessage(JSON.stringify({
      type: 'trade',
      data: [{ s: 'UNKNOWN:PAIR', p: 68000, t: 1713000001000 }],
    }));
    await ingestor.flushBatch();

    assert.equal(postedPayload, undefined);
  });

  it('keeps forex updates flowing even without crypto trades in the batch', async () => {
    const ingestor = new PriceIngestor() as any;
    let postedPayload: any[] | undefined;

    ingestor.nestApi = {
      post: async (_url: string, payload: any[]) => {
        postedPayload = payload;
      },
    };

    ingestor.handleMessage(JSON.stringify({
      type: 'trade',
      data: [{ s: 'OANDA:USD_JPY', p: 150, t: 1713000000000 }],
    }));
    await ingestor.flushBatch();

    assert.ok(postedPayload);
    assert.equal(postedPayload?.length, 1);
    assert.equal(postedPayload?.[0]?.symbol, 'USD/JPY');
    assert.equal(postedPayload?.[0]?.source, 'finnhub');
  });
});
