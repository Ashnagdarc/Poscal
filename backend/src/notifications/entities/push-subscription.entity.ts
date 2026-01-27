import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('push_subscriptions')
export class PushSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  user_id: string;

  @Column({ type: 'text' })
  endpoint: string;

  @Column({ type: 'text', name: 'p256dh' })
  p256dh_key: string;

  @Column({ type: 'text', name: 'auth' })
  auth_key: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  user_agent: string | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;
}
