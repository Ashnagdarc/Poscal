import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { TradingSignal } from '../entities/trading-signal.entity';
import { TakenTrade } from '../entities/taken-trade.entity';
import { CreateSignalDto, UpdateSignalDto, TakeSignalDto } from '../dto/trading-signal.dto';

@Injectable()
export class SignalsService {
  constructor(
    @InjectRepository(TradingSignal)
    private signalRepository: Repository<TradingSignal>,
    @InjectRepository(TakenTrade)
    private takenTradeRepository: Repository<TakenTrade>,
  ) {}

  async findAll(filters?: any): Promise<TradingSignal[]> {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    } else {
      where.status = 'active';
    }

    if (filters?.symbol) {
      where.symbol = filters.symbol;
    }

    return await this.signalRepository.find({
      where,
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string): Promise<TradingSignal> {
    const signal = await this.signalRepository.findOne({ where: { id } });
    
    if (!signal) {
      throw new NotFoundException('Signal not found');
    }

    return signal;
  }

  async create(createSignalDto: CreateSignalDto): Promise<TradingSignal> {
    const signal = this.signalRepository.create(createSignalDto);
    return await this.signalRepository.save(signal);
  }

  async update(id: string, updateSignalDto: UpdateSignalDto): Promise<TradingSignal> {
    const signal = await this.findOne(id);
    Object.assign(signal, updateSignalDto);
    return await this.signalRepository.save(signal);
  }

  async remove(id: string): Promise<void> {
    const signal = await this.findOne(id);
    await this.signalRepository.remove(signal);
  }

  async takeSignal(signalId: string, userId: string, takeSignalDto: TakeSignalDto): Promise<TakenTrade> {
    const signal = await this.findOne(signalId);

    if (signal.status !== 'active') {
      throw new Error('Signal is not active');
    }

    const takenTrade = this.takenTradeRepository.create({
      signal_id: signalId,
      user_id: userId,
      actual_entry: takeSignalDto.actual_entry,
      position_size: takeSignalDto.position_size,
      notes: takeSignalDto.notes,
      status: 'pending',
    });

    const saved = await this.takenTradeRepository.save(takenTrade);

    // Increment taken count
    signal.taken_count += 1;
    await this.signalRepository.save(signal);

    return saved;
  }

  async getUserTakenTrades(userId: string): Promise<TakenTrade[]> {
    return await this.takenTradeRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async updateTakenTrade(id: string, userId: string, status: string, resultPnl?: number): Promise<TakenTrade> {
    const takenTrade = await this.takenTradeRepository.findOne({ where: { id } });

    if (!takenTrade) {
      throw new NotFoundException('Taken trade not found');
    }

    if (takenTrade.user_id !== userId) {
      throw new Error('Access denied');
    }

    takenTrade.status = status;
    if (resultPnl !== undefined) {
      takenTrade.result_pnl = resultPnl;
    }

    return await this.takenTradeRepository.save(takenTrade);
  }

  async checkExpiredSignals(): Promise<void> {
    const expiredSignals = await this.signalRepository.find({
      where: {
        status: 'active',
        expires_at: MoreThan(new Date()),
      },
    });

    for (const signal of expiredSignals) {
      signal.status = 'expired';
      await this.signalRepository.save(signal);
    }
  }
}
