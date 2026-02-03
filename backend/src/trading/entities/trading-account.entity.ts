import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('trading_accounts')
export class TradingAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  user_id: string;

  @Column({ type: 'varchar', length: 255 })
  account_name: string;

  @Column({ type: 'varchar', length: 100 })
  platform: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  initial_balance: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  current_balance: number;

  @Column({ type: 'varchar', length: 10, default: 'USD' })
  currency: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}
