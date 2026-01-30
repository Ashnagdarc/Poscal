import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSetting } from './entities/app-setting.entity';

const PAID_LOCK_KEY = 'signals_paid_lock_enabled';

@Injectable()
export class FeatureFlagService {
  constructor(
    @InjectRepository(AppSetting)
    private readonly appSettingRepository: Repository<AppSetting>,
  ) {}

  async getPaidLockStatus(): Promise<boolean> {
    const setting = await this.appSettingRepository.findOne({
      where: { key: PAID_LOCK_KEY },
    });

    if (!setting) {
      // Default to false if not set
      return false;
    }

    // Handle both jsonb boolean and string values
    const val = setting.value;
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') return val === 'true';
    return !!val;
  }

  async setPaidLockStatus(enabled: boolean): Promise<boolean> {
    // Use raw query to properly handle jsonb boolean value
    await this.appSettingRepository.query(
      `INSERT INTO app_settings (key, value, description)
       VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
      [PAID_LOCK_KEY, JSON.stringify(enabled), 'Controls whether signals require paid subscription'],
    );

    return enabled;
  }
}
