import { Controller, Get, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IngestorHealth, IngestorHealthService } from './ingestor-health.service';
import { AuthService } from '../auth/auth.service';

@Controller('admin/ingestor-health')
export class IngestorHealthController {
  constructor(
    private readonly ingestorHealthService: IngestorHealthService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  @UseGuards(AuthGuard('jwt'))
  async getHealth(@Request() req: any): Promise<IngestorHealth> {
    const isAdmin = await this.authService.isAdmin(req.user.userId);
    if (!isAdmin) {
      throw new ForbiddenException('Only admins can view ingestor health');
    }
    return this.ingestorHealthService.getHealth();
  }
}
