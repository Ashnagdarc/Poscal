import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SignalsService } from '../services/signals.service';
import { CreateSignalDto, UpdateSignalDto, TakeSignalDto } from '../dto/trading-signal.dto';

@Controller('signals')
export class SignalsController {
  constructor(private signalsService: SignalsService) {}

  @Get()
  async findAll(@Query() query: any) {
    return await this.signalsService.findAll(query);
  }

  @Get('taken')
  @UseGuards(AuthGuard('jwt'))
  async getUserTakenTrades(@Request() req: any) {
    return await this.signalsService.getUserTakenTrades(req.user.userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.signalsService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  async create(@Body() createSignalDto: CreateSignalDto) {
    // TODO: Add admin check
    return await this.signalsService.create(createSignalDto);
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'))
  async update(@Param('id') id: string, @Body() updateSignalDto: UpdateSignalDto) {
    // TODO: Add admin check
    return await this.signalsService.update(id, updateSignalDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  async remove(@Param('id') id: string) {
    // TODO: Add admin check
    await this.signalsService.remove(id);
    return { message: 'Signal deleted successfully' };
  }

  @Post(':id/take')
  @UseGuards(AuthGuard('jwt'))
  async takeSignal(
    @Param('id') id: string,
    @Body() takeSignalDto: TakeSignalDto,
    @Request() req: any,
  ) {
    return await this.signalsService.takeSignal(id, req.user.userId, takeSignalDto);
  }

  @Put('taken/:id')
  @UseGuards(AuthGuard('jwt'))
  async updateTakenTrade(
    @Param('id') id: string,
    @Body() body: { status: string; result_pnl?: number },
    @Request() req: any,
  ) {
    return await this.signalsService.updateTakenTrade(id, req.user.userId, body.status, body.result_pnl);
  }
}
