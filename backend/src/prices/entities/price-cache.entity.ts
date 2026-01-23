import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('price_cache')
export class PriceCache {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  symbol: string;

  @Column({ type: 'decimal', precision: 15, scale: 5 })
  price: number;

  @Column({ type: 'decimal', precision: 15, scale: 5, nullable: true })
  bid: number | null;

  @Column({ type: 'decimal', precision: 15, scale: 5, nullable: true })
  ask: number | null;

  @Column({ type: 'decimal', precision: 15, scale: 5, nullable: true })
  high_24h: number | null;

  @Column({ type: 'decimal', precision: 15, scale: 5, nullable: true })
  low_24h: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  volume_24h: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  change_24h: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  change_percent_24h: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  source: string | null;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;
}
