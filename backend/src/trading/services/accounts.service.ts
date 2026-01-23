import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TradingAccount } from '../entities/trading-account.entity';
import { CreateTradingAccountDto, UpdateTradingAccountDto } from '../dto/trading-account.dto';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(TradingAccount)
    private accountRepository: Repository<TradingAccount>,
  ) {}

  async findAll(userId: string): Promise<TradingAccount[]> {
    return await this.accountRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<TradingAccount> {
    const account = await this.accountRepository.findOne({ where: { id } });
    
    if (!account) {
      throw new NotFoundException('Trading account not found');
    }

    if (account.user_id !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return account;
  }

  async create(createAccountDto: CreateTradingAccountDto): Promise<TradingAccount> {
    const account = this.accountRepository.create(createAccountDto);
    return await this.accountRepository.save(account);
  }

  async update(id: string, userId: string, updateAccountDto: UpdateTradingAccountDto): Promise<TradingAccount> {
    const account = await this.findOne(id, userId);
    Object.assign(account, updateAccountDto);
    return await this.accountRepository.save(account);
  }

  async remove(id: string, userId: string): Promise<void> {
    const account = await this.findOne(id, userId);
    await this.accountRepository.remove(account);
  }

  async updateBalance(id: string, userId: string, newBalance: number): Promise<TradingAccount> {
    const account = await this.findOne(id, userId);
    account.current_balance = newBalance;
    return await this.accountRepository.save(account);
  }
}
