import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { TradingSignal } from '../entities/trading-signal.entity';
import { CreateSignalDto, UpdateSignalDto } from '../dto/trading-signal.dto';

@Injectable()
export class SignalsService {
  constructor(
    @InjectRepository(TradingSignal)
    private signalRepository: Repository<TradingSignal>,
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
