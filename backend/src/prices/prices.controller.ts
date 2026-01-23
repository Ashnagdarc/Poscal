import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PricesService } from './prices.service';
import { ServiceTokenGuard } from '../auth/guards/service-token.guard';

@Controller('prices')
export class PricesController {
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

  @Post(':symbol')
  async updatePrice(@Param('symbol') symbol: string, @Body() priceData: any) {
    return await this.pricesService.updatePrice(symbol, priceData);
  }

  @Post('batch')
  async updatePrices(@Body() body: { prices: Array<{ symbol: string; data: any }> }) {
    return await this.pricesService.updatePrices(body.prices);
  }

  @Post('batch-update')
  @UseGuards(ServiceTokenGuard)
  async batchUpdatePrices(
    @Body()
    prices: Array<{ symbol: string; bid_price?: number; mid_price?: number; ask_price?: number; price?: number; source?: string }>,
  ) {
    await this.pricesService.batchUpsert(prices);
    return { updated: prices.length };
  }

  @Delete(':symbol')
  async deletePrice(@Param('symbol') symbol: string) {
    await this.pricesService.deletePrice(symbol);
    return { message: 'Price deleted successfully' };
  }
}
