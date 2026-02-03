import { Controller, Get, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminUsersService } from './admin-users.service';
import { AuthService } from '../auth/auth.service';

@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly adminUsersService: AdminUsersService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  @UseGuards(AuthGuard('jwt'))
  async listUsers(@Request() req: any) {
    const isAdmin = await this.authService.isAdmin(req.user.userId);
    if (!isAdmin) {
      throw new ForbiddenException('Only admins can view users');
    }

    return this.adminUsersService.listUsers();
  }
}
