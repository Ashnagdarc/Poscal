import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UpdatesService } from './updates.service';

@Controller('system/updates')
export class UpdatesController {
  constructor(private updatesService: UpdatesService) {}

  // GET is public - all users can view app updates
  @Get()
  async findAll() {
    return await this.updatesService.findAll();
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  async create(@Body() payload: { title: string; description: string }) {
    return await this.updatesService.create(payload);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  async update(
    @Param('id') id: string,
    @Body() updates: { is_active?: boolean; title?: string; description?: string },
  ) {
    return await this.updatesService.update(id, updates);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  async remove(@Param('id') id: string) {
    await this.updatesService.remove(id);
    return { success: true };
  }
}