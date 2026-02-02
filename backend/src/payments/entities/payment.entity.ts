import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  user_id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reference: string | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  amount: number | null;

  @Column({ type: 'varchar', length: 10, nullable: true, default: 'NGN' })
  currency: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  tier: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  subscription_tier: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true, default: 'pending' })
  status: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  payment_method: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  paystack_reference: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  paystack_transaction_id: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  paystack_access_code: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  paystack_customer_code: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  subscription_plan: string | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  subscription_start: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  subscription_end: Date | null;

  @Column({ type: 'integer', nullable: true })
  subscription_duration: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  ip_address: string | null;

  @Column({ type: 'text', nullable: true })
  user_agent: string | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  paid_at: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}
