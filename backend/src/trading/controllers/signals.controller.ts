import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SignalsService } from '../services/signals.service';
import { CreateSignalDto, UpdateSignalDto } from '../dto/trading-signal.dto';
import { AdminGuard } from '../../auth/guards/admin.guard';

@Controller('signals')
export class SignalsController {
  constructor(private signalsService: SignalsService) {}

  @Get()
  async findAll(@Query() query: any) {
    return await this.signalsService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.signalsService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  async create(@Body() createSignalDto: CreateSignalDto) {
    return await this.signalsService.create(createSignalDto);
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  async update(@Param('id') id: string, @Body() updateSignalDto: UpdateSignalDto) {
    return await this.signalsService.update(id, updateSignalDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  async remove(@Param('id') id: string) {
    await this.signalsService.remove(id);
    return { message: 'Signal deleted successfully' };
  }
}
