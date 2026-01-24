import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppUpdate } from './entities/app-update.entity';

@Injectable()
export class UpdatesService {
  constructor(
    @InjectRepository(AppUpdate)
    private updatesRepo: Repository<AppUpdate>,
  ) {}

  async findAll(): Promise<any[]> {
    const items = await this.updatesRepo.find({ order: { created_at: 'DESC' } });
    // Map to frontend expected shape
    return items.map((u) => ({
      id: u.id,
      title: u.version,
      description: u.release_notes,
      is_active: !!u.published_at,
      created_at: u.created_at,
    }));
  }

  async create(payload: { title: string; description: string }): Promise<any> {
    const entity = this.updatesRepo.create({
      version: payload.title,
      release_notes: payload.description,
      platform: 'web',
      is_mandatory: false,
      published_at: new Date(),
    });
    const saved = await this.updatesRepo.save(entity);
    return {
      id: saved.id,
      title: saved.version,
      description: saved.release_notes,
      is_active: !!saved.published_at,
      created_at: saved.created_at,
    };
  }

  async update(id: string, updates: { is_active?: boolean; title?: string; description?: string }): Promise<any> {
    const entity = await this.updatesRepo.findOne({ where: { id } });
    if (!entity) return null;
    if (typeof updates.is_active === 'boolean') {
      entity.published_at = updates.is_active ? new Date() : null;
    }
    if (updates.title) entity.version = updates.title;
    if (updates.description) entity.release_notes = updates.description;
    const saved = await this.updatesRepo.save(entity);
    return {
      id: saved.id,
      title: saved.version,
      description: saved.release_notes,
      is_active: !!saved.published_at,
      created_at: saved.created_at,
    };
  }

  async remove(id: string): Promise<void> {
    await this.updatesRepo.delete({ id });
  }
}