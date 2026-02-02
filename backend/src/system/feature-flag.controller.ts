import { Controller, Get, Post, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FeatureFlagService } from './feature-flag.service';
import { AuthService } from '../auth/auth.service';

// Admin controller for managing feature flags (requires auth)
@Controller('admin/feature-flag')
export class FeatureFlagController {
  constructor(
    private readonly featureFlagService: FeatureFlagService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  @UseGuards(AuthGuard('jwt'))
  async getFeatureFlag() {
    const enabled = await this.featureFlagService.getPaidLockStatus();
    return {
      success: true,
      enabled,
      message: 'Feature flag retrieved successfully',
    };
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  async setFeatureFlag(@Body('enabled') enabled: boolean, @Request() req: any) {
    // Only admins can update feature flags
    const isAdmin = await this.authService.isAdmin(req.user.userId);
    if (!isAdmin) {
      throw new ForbiddenException('Only admins can update feature flags');
    }

    if (typeof enabled !== 'boolean') {
      return {
        success: false,
        message: 'Invalid enabled value. Must be a boolean.',
      };
    }

    const newValue = await this.featureFlagService.setPaidLockStatus(enabled);
    return {
      success: true,
      enabled: newValue,
      message: 'Feature flag updated successfully',
    };
  }
}
