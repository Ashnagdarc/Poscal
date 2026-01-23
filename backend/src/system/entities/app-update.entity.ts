import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('app_updates')
export class AppUpdate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  version: string;

  @Column({ type: 'text' })
  release_notes: string;

  @Column({ type: 'varchar', length: 20 })
  platform: string;

  @Column({ type: 'text', nullable: true })
  download_url: string | null;

  @Column({ type: 'boolean', default: false })
  is_mandatory: boolean;

  @Column({ type: 'timestamp with time zone', nullable: true })
  published_at: Date | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;
}
