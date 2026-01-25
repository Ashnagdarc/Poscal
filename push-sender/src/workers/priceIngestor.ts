import type { AxiosInstance } from 'axios';
import WebSocket from 'ws';
import { loadPriceIngestorConfig, PriceIngestorConfig } from '../lib/config';
import { createNestApi } from '../lib/nestApi';
import { logger } from '../lib/logger';
import { withRetry } from '../lib/retry';
import { SYMBOL_MAPPINGS } from '../lib/symbols';
import { PriceBatchItem, FinnhubTradeMessage } from '../types';

const FINNHUB_WS_URL = 'wss://ws.finnhub.io';
const MAX_RECONNECT_ATTEMPTS = 25;
const RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_DELAY_MS = 60000;
const SUBSCRIBE_BATCH_SIZE = 25;
const SUBSCRIBE_BATCH_DELAY_MS = 400;
const METRICS_LOG_INTERVAL_MS = 60000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface PriceMetrics {
  tradesReceived: number;
  batchesFlushed: number;
  totalPricesSent: number;
}

export class PriceIngestor {
  private readonly config: PriceIngestorConfig;
  private readonly nestApi: AxiosInstance;
  private readonly priceBatch: Record<string, PriceBatchItem> = {};
  private readonly reverseSymbolMap = this.buildReverseSymbolMap();
  private readonly metrics: PriceMetrics = {
    tradesReceived: 0,
    batchesFlushed: 0,
    totalPricesSent: 0,
  };

  private websocket?: WebSocket;
  private flushTimer?: NodeJS.Timeout;
  private metricsTimer?: NodeJS.Timeout;
  private reconnectTimer?: NodeJS.Timeout;
  private reconnectAttempts = 0;
  private reconnectDelayMs = RECONNECT_DELAY_MS;
  private lastCloseRateLimited = false;

  constructor() {
    this.config = loadPriceIngestorConfig();
    this.nestApi = createNestApi({
      baseUrl: this.config.nestApiUrl,
      serviceToken: this.config.serviceToken,
    });
  }

  async start(): Promise<void> {
    logger.info('Starting price ingestor', {
      backend: this.config.nestApiUrl,
      batchIntervalMs: this.config.batchIntervalMs,
      subscriptions: this.reverseSymbolMap.size,
    });

    this.connect();

    this.flushTimer = setInterval(() => {
      void this.flushBatch();
    }, this.config.batchIntervalMs);

    this.metricsTimer = setInterval(() => this.logMetrics(), METRICS_LOG_INTERVAL_MS);
  }

  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = undefined;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.close();
    }

    Object.keys(this.priceBatch).forEach((key) => delete this.priceBatch[key]);
  }

  private buildReverseSymbolMap(): Map<string, string[]> {
    const reverse = new Map<string, string[]>();
    Object.entries(SYMBOL_MAPPINGS).forEach(([displaySymbol, finnhubSymbol]) => {
      const entries = reverse.get(finnhubSymbol) ?? [];
      entries.push(displaySymbol);
      reverse.set(finnhubSymbol, entries);
    });
    return reverse;
  }

  private connect(): void {
    this.websocket = new WebSocket(`${FINNHUB_WS_URL}?token=${this.config.finnhubApiKey}`);

    this.websocket.on('open', () => {
      logger.info('Connected to Finnhub WebSocket');
      this.reconnectAttempts = 0;
      this.reconnectDelayMs = RECONNECT_DELAY_MS;
      void this.subscribeAllSymbols();
    });

    this.websocket.on('message', (payload) => {
      this.handleMessage(payload.toString());
    });

    this.websocket.on('error', (error: Error) => {
      const isRateLimit = /429/.test(error.message ?? '');
      if (isRateLimit) {
        this.lastCloseRateLimited = true;
        this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, MAX_RECONNECT_DELAY_MS);
        logger.warn('Finnhub WebSocket rate limit encountered', { reconnectDelayMs: this.reconnectDelayMs });
      } else {
        logger.error('Finnhub WebSocket error', { error: error.message });
      }
    });

    this.websocket.on('close', () => {
      logger.warn('Finnhub WebSocket closed');
      this.scheduleReconnect(this.lastCloseRateLimited);
      this.lastCloseRateLimited = false;
    });
  }

  private async subscribeAllSymbols(): Promise<void> {
    const uniqueSymbols = [...new Set(Object.values(SYMBOL_MAPPINGS))];
    const batches = Math.ceil(uniqueSymbols.length / SUBSCRIBE_BATCH_SIZE) || 1;

    for (let i = 0; i < uniqueSymbols.length; i += SUBSCRIBE_BATCH_SIZE) {
      const batch = uniqueSymbols.slice(i, i + SUBSCRIBE_BATCH_SIZE);
      batch.forEach((symbol) => {
        if (this.websocket?.readyState === WebSocket.OPEN) {
          this.websocket.send(JSON.stringify({ type: 'subscribe', symbol }));
        }
      });

      if (i + SUBSCRIBE_BATCH_SIZE < uniqueSymbols.length) {
        await sleep(SUBSCRIBE_BATCH_DELAY_MS);
      }
    }

    logger.info('Subscribed to Finnhub symbols', { count: uniqueSymbols.length, batches });
  }

  private handleMessage(serialized: string): void {
    try {
      const message: FinnhubTradeMessage = JSON.parse(serialized);
      if (message.type !== 'trade' || !Array.isArray(message.data)) {
        return;
      }

      this.metrics.tradesReceived += message.data.length;

      for (const trade of message.data) {
        if (typeof trade.p !== 'number') {
          continue;
        }

        const mappedSymbols = this.reverseSymbolMap.get(trade.s);
        if (!mappedSymbols?.length) {
          continue;
        }

        const price = trade.p;
        const spread = price * 0.0001;

        for (const symbol of mappedSymbols) {
          this.priceBatch[symbol] = {
            symbol,
            mid_price: price,
            ask_price: price + spread / 2,
            bid_price: price - spread / 2,
            timestamp: trade.t,
            updated_at: new Date().toISOString(),
          };
        }
      }
    } catch (error) {
      logger.error('Failed to process Finnhub payload', { error: (error as Error).message });
    }
  }

  private async flushBatch(): Promise<void> {
    const batch = Object.values(this.priceBatch);
    if (batch.length === 0) {
      return;
    }

    try {
      await withRetry(() =>
        this.nestApi.post(
          '/prices/batch-update',
          batch.map((item) => ({
            symbol: item.symbol,
            bid_price: item.bid_price,
            mid_price: item.mid_price,
            ask_price: item.ask_price,
            timestamp: item.timestamp,
            source: 'finnhub',
          })),
        ),
      );

      this.metrics.batchesFlushed++;
      this.metrics.totalPricesSent += batch.length;
      logger.info('Flushed price batch', { size: batch.length });
    } catch (error) {
      logger.error('Failed to upsert price batch', { error: (error as Error).message });
    } finally {
      batch.forEach((item) => delete this.priceBatch[item.symbol]);
    }
  }

  private scheduleReconnect(rateLimited: boolean): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      logger.error('Max Finnhub reconnect attempts reached');
      this.reconnectAttempts = 0;
    }

    this.reconnectAttempts++;
    const delay = rateLimited ? this.reconnectDelayMs : RECONNECT_DELAY_MS;
    if (!rateLimited) {
      this.reconnectDelayMs = RECONNECT_DELAY_MS;
    }

    logger.warn('Reconnecting to Finnhub', { attempt: this.reconnectAttempts, delayMs: delay, rateLimited });

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, Math.min(delay, MAX_RECONNECT_DELAY_MS));
  }

  private logMetrics(): void {
    logger.info('Price ingestor metrics', {
      tradesReceived: this.metrics.tradesReceived,
      batchesFlushed: this.metrics.batchesFlushed,
      totalPricesSent: this.metrics.totalPricesSent,
      batchSize: Object.keys(this.priceBatch).length,
    });
  }
}
