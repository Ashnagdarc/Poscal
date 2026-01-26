import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from '../../storage/storage.service';
import { AuthGuard } from '@nestjs/passport';
import { TradesService } from '../services/trades.service';
import { CreateTradeDto, UpdateTradeDto } from '../dto/trading-journal.dto';

@Controller('trades')
@UseGuards(AuthGuard('jwt'))
export class TradesController {
  constructor(private tradesService: TradesService, private storageService: StorageService) {}

  @Get()
  async findAll(@Request() req: any, @Query() query: any) {
    return await this.tradesService.findAll(req.user.userId, query);
  }

  @Get('statistics')
  async getStatistics(@Request() req: any, @Query('account_id') accountId?: string) {
    return await this.tradesService.getStatistics(req.user.userId, accountId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return await this.tradesService.findOne(id, req.user.userId);
  }

  @Post()
  async create(@Body() createTradeDto: CreateTradeDto, @Request() req: any) {
    createTradeDto.user_id = req.user.userId;
    return await this.tradesService.create(createTradeDto);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateTradeDto: UpdateTradeDto,
    @Request() req: any,
  ) {
    return await this.tradesService.update(id, req.user.userId, updateTradeDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req: any) {
    await this.tradesService.remove(id, req.user.userId);
    return { message: 'Trade deleted successfully' };
  }

  // Upload a trade screenshot (stub storage)
  @Post(':id/screenshots')
  @UseInterceptors(FileInterceptor('file'))
  async uploadScreenshot(
    @Param('id') id: string,
    @UploadedFile() file: any,
  ) {
    const url = await this.storageService.saveTradeScreenshot(id, file);
    return { url };
  }

  // Delete a trade screenshot (stub)
  @Delete('screenshots/:screenshotId')
  async deleteScreenshot(@Param('screenshotId') screenshotId: string) {
    // Expect screenshotId format: tradeId/fileName
    const parts = screenshotId.split('/');
    if (parts.length >= 2) {
      const tradeId = parts[0];
      const fileName = parts.slice(1).join('/');
      await this.storageService.deleteTradeScreenshot(tradeId, fileName);
    }
    return { success: true };
  }
}
