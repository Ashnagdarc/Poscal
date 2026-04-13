import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('price_cache')
export class PriceCache {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  symbol: string;

  @Column({ type: 'decimal', precision: 15, scale: 6 })
  bid_price: number;

  @Column({ type: 'decimal', precision: 15, scale: 6 })
  ask_price: number;

  @Column({ type: 'decimal', precision: 15, scale: 6 })
  mid_price: number;

  @Column({ type: 'bigint', nullable: true })
  timestamp: number | null;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;
}
