import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('taken_trades')
export class TakenTrade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  signal_id: string;

  @Column('uuid')
  user_id: string;

  @Column({ type: 'decimal', precision: 15, scale: 5, nullable: true })
  actual_entry: number | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  position_size: number | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  result_pnl: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;
}
