import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('validate')
  validateToken(@Body('token') token: string) {
    const payload = this.authService.validateToken(token);
    return {
      valid: true,
      payload,
    };
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  getCurrentUser(@Request() req: any) {
    return {
      user: req.user,
    };
  }
}
