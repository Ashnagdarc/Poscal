import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TradingAccount } from '../entities/trading-account.entity';
import { CreateTradingAccountDto, UpdateTradingAccountDto } from '../dto/trading-account.dto';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(TradingAccount)
    private readonly accountsRepository: Repository<TradingAccount>,
  ) {}

  async findAll(userId: string): Promise<TradingAccount[]> {
    return this.accountsRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<TradingAccount> {
    const account = await this.accountsRepository.findOne({ where: { id, user_id: userId } });
    if (!account) {
      throw new NotFoundException('Trading account not found');
    }
    return account;
  }

  async create(payload: CreateTradingAccountDto): Promise<TradingAccount> {
    const account = this.accountsRepository.create({
      ...payload,
      currency: payload.currency ?? 'USD',
      is_active: payload.is_active ?? true,
    });
    return this.accountsRepository.save(account);
  }

  async update(id: string, userId: string, updates: UpdateTradingAccountDto): Promise<TradingAccount> {
    const account = await this.findOne(id, userId);
    Object.assign(account, updates);
    return this.accountsRepository.save(account);
  }

  async remove(id: string, userId: string): Promise<void> {
    const account = await this.findOne(id, userId);
    await this.accountsRepository.remove(account);
  }
}
