import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('trading_signals')
export class TradingSignal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'varchar', length: 10 })
  direction: string;

  @Column({ type: 'decimal', precision: 15, scale: 5 })
  entry_price: number;

  @Column({ type: 'decimal', precision: 15, scale: 5 })
  stop_loss: number;

  @Column({ type: 'decimal', precision: 15, scale: 5 })
  take_profit: number;

  @Column({ type: 'text', nullable: true })
  analysis: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  timeframe: string | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  expires_at: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  confidence_score: number | null;

  @Column({ type: 'integer', default: 0 })
  taken_count: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}
