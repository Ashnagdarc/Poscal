import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { TradingJournal } from '../entities/trading-journal.entity';
import { CreateTradeDto, UpdateTradeDto } from '../dto/trading-journal.dto';

@Injectable()
export class TradesService {
  constructor(
    @InjectRepository(TradingJournal)
    private tradeRepository: Repository<TradingJournal>,
  ) {}

  async findAll(userId: string, filters?: any): Promise<TradingJournal[]> {
    const where: any = { user_id: userId };

    if (filters?.account_id) {
      where.account_id = filters.account_id;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.symbol) {
      where.symbol = filters.symbol;
    }

    if (filters?.start_date && filters?.end_date) {
      where.trade_date = Between(filters.start_date, filters.end_date);
    }

    return await this.tradeRepository.find({
      where,
      order: { trade_date: 'DESC', created_at: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<TradingJournal> {
    const trade = await this.tradeRepository.findOne({ where: { id } });
    
    if (!trade) {
      throw new NotFoundException('Trade not found');
    }

    if (trade.user_id !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return trade;
  }

  async create(createTradeDto: CreateTradeDto): Promise<TradingJournal> {
    const trade = this.tradeRepository.create(createTradeDto);
    return await this.tradeRepository.save(trade);
  }

  async update(id: string, userId: string, updateTradeDto: UpdateTradeDto): Promise<TradingJournal> {
    const trade = await this.findOne(id, userId);
    Object.assign(trade, updateTradeDto);
    return await this.tradeRepository.save(trade);
  }

  async remove(id: string, userId: string): Promise<void> {
    const trade = await this.findOne(id, userId);
    await this.tradeRepository.remove(trade);
  }

  async getStatistics(userId: string, accountId?: string): Promise<any> {
    const where: any = { user_id: userId };
    if (accountId) {
      where.account_id = accountId;
    }

    const trades = await this.tradeRepository.find({ where });

    const closedTrades = trades.filter(t => t.status === 'closed');
    const totalTrades = closedTrades.length;
    const winningTrades = closedTrades.filter(t => t.profit_loss && t.profit_loss > 0);
    const losingTrades = closedTrades.filter(t => t.profit_loss && t.profit_loss < 0);

    const totalPnL = closedTrades.reduce((sum, t) => sum + (t.profit_loss || 0), 0);
    const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;

    return {
      total_trades: totalTrades,
      winning_trades: winningTrades.length,
      losing_trades: losingTrades.length,
      win_rate: winRate,
      total_pnl: totalPnL,
      average_win: winningTrades.length > 0 
        ? winningTrades.reduce((sum, t) => sum + (t.profit_loss || 0), 0) / winningTrades.length 
        : 0,
      average_loss: losingTrades.length > 0
        ? losingTrades.reduce((sum, t) => sum + (t.profit_loss || 0), 0) / losingTrades.length
        : 0,
    };
  }
}
