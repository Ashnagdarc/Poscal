import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('paystack_webhook_logs')
export class PaystackWebhookLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  event: string;

  @Column({ type: 'jsonb' })
  data: any;

  @Column({ type: 'varchar', length: 20 })
  status: string;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reference: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;
}
