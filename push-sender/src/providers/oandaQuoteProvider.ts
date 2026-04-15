import axios, { AxiosInstance } from 'axios';
import http from 'http';
import https from 'https';

import { PriceIngestorConfig } from '../lib/config';
import { logger } from '../lib/logger';
import { withRetry } from '../lib/retry';
import { PriceBatchItem, OandaClientPrice, OandaPricingResponse } from '../types';

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

export function parseNumericString(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function getBestAsk(price: OandaClientPrice): number | undefined {
  return parseNumericString(price.closeoutAsk) ?? parseNumericString(price.asks?.[0]?.price);
}

export function getBestBid(price: OandaClientPrice): number | undefined {
  return parseNumericString(price.closeoutBid) ?? parseNumericString(price.bids?.[0]?.price);
}

export function mapOandaResponseToQuotes(
  symbolBatch: Array<[string, string]>,
  response: OandaPricingResponse,
): PriceBatchItem[] {
  const instrumentToDisplay = new Map(
    symbolBatch.map(([displaySymbol, providerSymbol]) => [providerSymbol.replace('OANDA:', ''), displaySymbol]),
  );

  const quotes: PriceBatchItem[] = [];

  for (const price of response.prices ?? []) {
    if (price.status && price.status !== 'tradeable') {
      logger.debug('Skipping non-tradeable OANDA instrument', {
        instrument: price.instrument,
        status: price.status,
      });
      continue;
    }

    const displaySymbol = instrumentToDisplay.get(price.instrument);
    if (!displaySymbol) {
      continue;
    }

    const ask = getBestAsk(price);
    const bid = getBestBid(price);

    if (ask === undefined || bid === undefined) {
      logger.warn('Skipping OANDA price without bid/ask', {
        instrument: price.instrument,
      });
      continue;
    }

    quotes.push({
      symbol: displaySymbol,
      ask_price: ask,
      bid_price: bid,
      mid_price: (ask + bid) / 2,
      timestamp: new Date(price.time).getTime(),
      updated_at: new Date().toISOString(),
      source: 'oanda',
    });
  }

  return quotes;
}

export class OandaQuoteProvider {
  private readonly client: AxiosInstance;
  private readonly instrumentChunkSize: number;

  constructor(private readonly config: PriceIngestorConfig) {
    this.instrumentChunkSize = Math.max(1, config.oandaInstrumentChunkSize);
    this.client = axios.create({
      baseURL: config.oandaApiUrl,
      timeout: 30000,
      headers: {
        Authorization: `Bearer ${config.oandaApiKey}`,
        'Content-Type': 'application/json',
      },
      httpAgent: new http.Agent({ keepAlive: true, keepAliveMsecs: 1000, maxSockets: 20 }),
      httpsAgent: new https.Agent({ keepAlive: true, keepAliveMsecs: 1000, maxSockets: 20 }),
    });
  }

  async getQuotes(symbolMappings: Record<string, string>): Promise<PriceBatchItem[]> {
    const entries = Object.entries(symbolMappings);
    const entryBatches = chunk(entries, this.instrumentChunkSize);
    const quotes: PriceBatchItem[] = [];

    for (const batch of entryBatches) {
      const response = await withRetry(
        () =>
          this.client.get<OandaPricingResponse>(`/v3/accounts/${this.config.oandaAccountId}/pricing`, {
            params: {
              instruments: batch.map(([, providerSymbol]) => providerSymbol.replace('OANDA:', '')).join(','),
              includeHomeConversions: false,
              includeUnitsAvailable: false,
            },
          }),
        { retries: 2, delayMs: 500 },
      );

      const batchQuotes = mapOandaResponseToQuotes(batch, response.data);
      quotes.push(...batchQuotes);
    }

    return quotes;
  }
}
