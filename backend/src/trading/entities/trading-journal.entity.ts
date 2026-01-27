import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('trading_journal')
export class TradingJournal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  user_id: string;

  @Column({ type: 'uuid', nullable: true })
  account_id: string | null;

  @Column({ type: 'date' })
  trade_date: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  symbol: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  direction: string | null;

  @Column({ type: 'decimal', precision: 15, scale: 5, nullable: true })
  entry_price: number | null;

  @Column({ type: 'decimal', precision: 15, scale: 5, nullable: true })
  exit_price: number | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  position_size: number | null;

  @Column({ type: 'decimal', precision: 15, scale: 5, nullable: true })
  stop_loss: number | null;

  @Column({ type: 'decimal', precision: 15, scale: 5, nullable: true })
  take_profit: number | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  profit_loss: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  profit_loss_percentage: number | null;

  @Column({ type: 'varchar', length: 20, default: 'open' })
  status: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 20, default: 'structured' })
  journal_type: string;

  @Column({ type: 'jsonb', nullable: true })
  rich_content: any;

  @Column({ type: 'jsonb', nullable: true })
  images: any;

  @Column({ type: 'jsonb', nullable: true })
  links: any;

  @Column({ type: 'varchar', length: 100, nullable: true })
  strategy: string | null;

  @Column({ type: 'text', nullable: true })
  tags: string | null;

  @Column({ type: 'text', nullable: true })
  screenshots: string | null;

  @Column({ type: 'text', nullable: true })
  trade_setup: string | null;

  @Column({ type: 'text', nullable: true })
  psychological_state: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  risk_reward_ratio: number | null;

  @Column({ type: 'integer', nullable: true })
  session_number: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  market_condition: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}
