import { Controller, Get } from '@nestjs/common';
import { FeatureFlagService } from '../system/feature-flag.service';
import { UpdatesService } from '../system/updates.service';

@Controller()
export class PublicController {
  constructor(
    private readonly featureFlagService: FeatureFlagService,
    private readonly updatesService: UpdatesService,
  ) {}

  @Get('public/feature-flag/paid-lock')
  async getPaidLockStatus() {
    const enabled = await this.featureFlagService.getPaidLockStatus();
    return { success: true, enabled };
  }

  @Get('system/updates')
  async getUpdates() {
    return await this.updatesService.findAll();
  }
}
