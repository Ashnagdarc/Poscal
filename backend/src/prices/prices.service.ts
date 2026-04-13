import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PriceCache } from './entities/price-cache.entity';

@Injectable()
export class PricesService {
  constructor(
    @InjectRepository(PriceCache)
    private priceCacheRepository: Repository<PriceCache>,
  ) {}

  async getPrice(symbol: string): Promise<PriceCache | null> {
    return await this.priceCacheRepository.findOne({ where: { symbol } });
  }

  async getAllPrices(): Promise<PriceCache[]> {
    return await this.priceCacheRepository.find({
      order: { updated_at: 'DESC' },
    });
  }

  async updatePrice(symbol: string, priceData: Partial<PriceCache>): Promise<PriceCache> {
    let price = await this.getPrice(symbol);

    if (price) {
      Object.assign(price, priceData);
      price.updated_at = new Date();
    } else {
      price = this.priceCacheRepository.create({
        symbol,
        ...priceData,
      });
    }

    return await this.priceCacheRepository.save(price);
  }

  async updatePrices(prices: Array<{ symbol: string; data: Partial<PriceCache> }>): Promise<PriceCache[]> {
    const updated: PriceCache[] = [];

    for (const { symbol, data } of prices) {
      const price = await this.updatePrice(symbol, data);
      updated.push(price);
    }

    return updated;
  }

  async batchUpsert(
    prices: Array<{ symbol: string; bid_price?: number; mid_price?: number; ask_price?: number; price?: number; source?: string; timestamp?: number }>,
  ): Promise<void> {
    if (prices.length === 0) return;

    // Build parameterized query — never concatenate user-supplied values into SQL
    const params: (string | number | null)[] = [];
    const valuePlaceholders = prices.map((p, i) => {
      const base = i * 5;
      const midPrice = p.mid_price ?? p.price ?? p.ask_price ?? p.bid_price ?? 0;
      params.push(p.symbol, p.bid_price ?? null, p.ask_price ?? null, midPrice, p.timestamp ?? null);
      return `($${base + 1}::varchar, $${base + 2}::numeric, $${base + 3}::numeric, $${base + 4}::numeric, NOW(), NOW(), $${base + 5}::bigint)`;
    });

    const sql = `
      INSERT INTO price_cache (symbol, bid_price, ask_price, mid_price, created_at, updated_at, timestamp)
      VALUES ${valuePlaceholders.join(',')}
      ON CONFLICT (symbol)
      DO UPDATE SET
        bid_price = EXCLUDED.bid_price,
        ask_price = EXCLUDED.ask_price,
        mid_price = EXCLUDED.mid_price,
        updated_at = EXCLUDED.updated_at,
        timestamp = EXCLUDED.timestamp
    `;

    await this.priceCacheRepository.query(sql, params);
  }

  async deletePrice(symbol: string): Promise<void> {
    await this.priceCacheRepository.delete({ symbol });
  }

  async getMultiplePrices(symbols: string[]): Promise<PriceCache[]> {
    return await this.priceCacheRepository
      .createQueryBuilder('price')
      .where('price.symbol IN (:...symbols)', { symbols })
      .getMany();
  }
}
