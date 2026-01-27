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

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  updated_at: Date;
}
