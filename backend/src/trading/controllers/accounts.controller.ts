import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AccountsService } from '../services/accounts.service';
import { CreateTradingAccountDto, UpdateTradingAccountDto } from '../dto/trading-account.dto';

@Controller('accounts')
@UseGuards(AuthGuard('jwt'))
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  async findAll(@Request() req: any) {
    return this.accountsService.findAll(req.user.userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.accountsService.findOne(id, req.user.userId);
  }

  @Post()
  async create(@Body() payload: CreateTradingAccountDto, @Request() req: any) {
    payload.user_id = req.user.userId;
    return this.accountsService.create(payload);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updates: UpdateTradingAccountDto,
    @Request() req: any,
  ) {
    return this.accountsService.update(id, req.user.userId, updates);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req: any) {
    await this.accountsService.remove(id, req.user.userId);
    return { success: true };
  }
}
