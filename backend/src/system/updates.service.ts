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
    try {
      const items = await this.updatesRepo.find({ order: { created_at: 'DESC' } });
      return items.map((u) => ({
        id: u.id,
        title: u.title,
        description: u.description,
        is_active: u.is_active,
        created_at: u.created_at,
      }));
    } catch (error: any) {
      console.error('Error fetching app updates:', error?.message || error);
      // Return empty array if table doesn't exist (migration not run yet)
      if (error?.code === 'ER_NO_SUCH_TABLE' || error?.message?.includes('does not exist')) {
        return [];
      }
      throw error;
    }
  }

  async create(payload: { title: string; description: string }): Promise<any> {
    const entity = this.updatesRepo.create({
      title: payload.title,
      description: payload.description,
      is_active: true,
    });
    const saved = await this.updatesRepo.save(entity);
    return {
      id: saved.id,
      title: saved.title,
      description: saved.description,
      is_active: saved.is_active,
      created_at: saved.created_at,
    };
  }

  async update(id: string, updates: { is_active?: boolean; title?: string; description?: string }): Promise<any> {
    const entity = await this.updatesRepo.findOne({ where: { id } });
    if (!entity) return null;
    if (typeof updates.is_active === 'boolean') {
      entity.is_active = updates.is_active;
    }
    if (updates.title) entity.title = updates.title;
    if (updates.description) entity.description = updates.description;
    const saved = await this.updatesRepo.save(entity);
    return {
      id: saved.id,
      title: saved.title,
      description: saved.description,
      is_active: saved.is_active,
      created_at: saved.created_at,
    };
  }

  async remove(id: string): Promise<void> {
    await this.updatesRepo.delete({ id });
  }
}
