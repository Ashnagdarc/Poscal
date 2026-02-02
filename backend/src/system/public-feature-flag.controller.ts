import { Controller, Get } from '@nestjs/common';
import { FeatureFlagService } from './feature-flag.service';

// Public controller for reading feature flags (no auth required)
@Controller('public/feature-flag')
export class PublicFeatureFlagController {
  constructor(private readonly featureFlagService: FeatureFlagService) {}

  @Get('paid-lock')
  async getPaidLockStatus() {
    const enabled = await this.featureFlagService.getPaidLockStatus();
    return {
      success: true,
      enabled,
    };
  }
}
