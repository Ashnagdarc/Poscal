import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AccountsService } from '../services/accounts.service';
import { CreateTradingAccountDto, UpdateTradingAccountDto } from '../dto/trading-account.dto';

@Controller('accounts')
@UseGuards(AuthGuard('jwt'))
export class AccountsController {
  constructor(private accountsService: AccountsService) {}

  @Get()
  async findAll(@Request() req: any) {
    return await this.accountsService.findAll(req.user.userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return await this.accountsService.findOne(id, req.user.userId);
  }

  @Post()
  async create(@Body() createAccountDto: CreateTradingAccountDto, @Request() req: any) {
    createAccountDto.user_id = req.user.userId;
    return await this.accountsService.create(createAccountDto);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateAccountDto: UpdateTradingAccountDto,
    @Request() req: any,
  ) {
    return await this.accountsService.update(id, req.user.userId, updateAccountDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req: any) {
    await this.accountsService.remove(id, req.user.userId);
    return { message: 'Account deleted successfully' };
  }

  @Put(':id/balance')
  async updateBalance(
    @Param('id') id: string,
    @Body('balance') balance: number,
    @Request() req: any,
  ) {
    return await this.accountsService.updateBalance(id, req.user.userId, balance);
  }
}
