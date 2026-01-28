import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('trading_signals')
export class TradingSignal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  currency_pair: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  symbol: string | null;

  @Column({ type: 'varchar', length: 10 })
  direction: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  market_execution: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 5 })
  entry_price: number;

  @Column({ type: 'decimal', precision: 10, scale: 5 })
  stop_loss: number;

  @Column({ type: 'decimal', precision: 10, scale: 5 })
  take_profit_1: number;

  @Column({ type: 'decimal', precision: 10, scale: 5, nullable: true })
  take_profit_2: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 5, nullable: true })
  take_profit_3: number | null;

  @Column({ type: 'decimal', precision: 15, scale: 5, nullable: true })
  take_profit: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  pips_to_sl: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  pips_to_tp1: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  pips_to_tp2: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  pips_to_tp3: number | null;

  @Column({ type: 'text', nullable: true })
  analysis: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  timeframe: string | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  expires_at: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  result: string | null;

  @Column({ type: 'boolean', default: false })
  tp1_hit: boolean;

  @Column({ type: 'boolean', default: false })
  tp2_hit: boolean;

  @Column({ type: 'boolean', default: false })
  tp3_hit: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'text', nullable: true })
  chart_image_url: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  confidence_score: number | null;

  @Column({ type: 'integer', default: 0 })
  taken_count: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  closed_at: Date | null;
}
