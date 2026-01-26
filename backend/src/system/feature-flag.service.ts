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

    return setting.value === 'true';
  }

  async setPaidLockStatus(enabled: boolean): Promise<boolean> {
    const value = enabled ? 'true' : 'false';

    await this.appSettingRepository.upsert(
      {
        key: PAID_LOCK_KEY,
        value,
        description: 'Controls whether signals require paid subscription',
      },
      ['key'],
    );

    return enabled;
  }
}
