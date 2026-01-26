import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Logger } from '@nestjs/common';
import { PricesService } from './prices.service';
import { ServiceTokenGuard } from '../auth/guards/service-token.guard';

@Controller('prices')
export class PricesController {
  private readonly logger = new Logger(PricesController.name);

  constructor(private pricesService: PricesService) {}

  @Get()
  async getAllPrices() {
    return await this.pricesService.getAllPrices();
  }

  @Get('multiple')
  async getMultiplePrices(@Query('symbols') symbols: string) {
    const symbolArray = symbols.split(',');
    return await this.pricesService.getMultiplePrices(symbolArray);
  }

  @Get(':symbol')
  async getPrice(@Param('symbol') symbol: string) {
    return await this.pricesService.getPrice(symbol);
  }

  @Post('batch-update')
  @UseGuards(ServiceTokenGuard)
  async batchUpdatePrices(
    @Body()
    prices: Array<{ symbol: string; bid_price?: number; mid_price?: number; ask_price?: number; price?: number; source?: string; timestamp?: number }>,
  ) {
    const start = Date.now();
    const uniqueSymbols = new Set(prices.map((p) => p.symbol)).size;
    const oldestTimestamp = prices.reduce<number | undefined>((earliest, price) => {
      if (typeof price.timestamp !== 'number') {
        return earliest;
      }
      if (earliest === undefined || price.timestamp < earliest) {
        return price.timestamp;
      }
      return earliest;
    }, undefined);
    const sourceBreakdown = prices.reduce<Record<string, number>>((acc, price) => {
      const key = price.source ?? 'unknown';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const receivedMeta = { count: prices.length, uniqueSymbols, sourceBreakdown };
    this.logger.log(`prices/batch-update received :: ${JSON.stringify(receivedMeta)}`);

    await this.pricesService.batchUpsert(prices);

    const durationMs = Date.now() - start;
    const ingestionDelayMs = oldestTimestamp ? Date.now() - oldestTimestamp : undefined;

    const persistedMeta = { count: prices.length, uniqueSymbols, durationMs, ingestionDelayMs };
    this.logger.log(`prices/batch-update persisted :: ${JSON.stringify(persistedMeta)}`);

    return { updated: prices.length, uniqueSymbols, durationMs, ingestionDelayMs };
  }

  @Post('batch')
  async updatePrices(@Body() body: { prices: Array<{ symbol: string; data: any }> }) {
    return await this.pricesService.updatePrices(body.prices);
  }

  @Post(':symbol')
  async updatePrice(@Param('symbol') symbol: string, @Body() priceData: any) {
    return await this.pricesService.updatePrice(symbol, priceData);
  }

  @Delete(':symbol')
  async deletePrice(@Param('symbol') symbol: string) {
    await this.pricesService.deletePrice(symbol);
    return { message: 'Price deleted successfully' };
  }
}
