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
    prices: Array<{ symbol: string; bid_price?: number; mid_price?: number; ask_price?: number; price?: number; source?: string }>,
  ): Promise<void> {
    if (prices.length === 0) return;

    // Use raw SQL INSERT ON CONFLICT instead of TypeORM upsert (which is broken)
    const values = prices.map((p) => {
      const midPrice = p.mid_price ?? p.price ?? p.ask_price ?? p.bid_price ?? 0;
      return `('${p.symbol.replace(/'/g, "''")}', ${p.bid_price ?? 'NULL'}, ${p.ask_price ?? 'NULL'}, ${midPrice}, NOW(), NOW())`;
    }).join(',');

    const sql = `
      INSERT INTO price_cache (symbol, bid_price, ask_price, mid_price, created_at, updated_at)
      VALUES ${values}
      ON CONFLICT (symbol)
      DO UPDATE SET
        bid_price = EXCLUDED.bid_price,
        ask_price = EXCLUDED.ask_price,
        mid_price = EXCLUDED.mid_price,
        updated_at = EXCLUDED.updated_at
    `;

    await this.priceCacheRepository.query(sql);
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
