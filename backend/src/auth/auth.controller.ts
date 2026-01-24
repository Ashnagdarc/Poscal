import { Controller, Get, Post, Put, Body, UseGuards, Request, Param } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ValidateTokenDto } from './dto/auth.dto';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { SignUpDto, SignInDto } from './dto/signup.dto';
import { JwtAuthGuard } from './jwt.guard';
import { EmulateRLSGuard } from './guards/rls.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Post('signup')
  async signup(@Body() signUpDto: SignUpDto) {
    const { user, token } = await this.authService.signUp(signUpDto);
    return {
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        email_verified: user.email_verified,
      },
      token,
    };
  }

  @Post('signin')
  async signin(@Body() signInDto: SignInDto) {
    const { user, token } = await this.authService.signIn(signInDto);
    return {
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        email_verified: user.email_verified,
      },
      token,
    };
  }

  @Post('validate')
  async validateToken(@Body() validateTokenDto: ValidateTokenDto) {
    const payload = this.authService.validateToken(validateTokenDto.token);
    return {
      valid: true,
      payload,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('me')
  async currentUser(@Request() req: any) {
    const profile = await this.authService.getProfile(req.user.userId);
    const roles = await this.authService.getUserRoles(req.user.userId);
    return {
      user: req.user,
      profile,
      roles: roles.map(r => r.role),
    };
  }

  // Keep existing GET /auth/me for backward compatibility
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@Request() req: any) {
    return this.currentUser(req);
  }

  @Get('profile/:id')
  @UseGuards(JwtAuthGuard, EmulateRLSGuard)
  async getProfile(@Param('id') id: string) {
    return await this.authService.getProfile(id);
  }

  @Post('profile')
  async createProfile(@Body() createProfileDto: CreateProfileDto) {
    return await this.authService.createProfile(createProfileDto);
  }

  @Put('profile/:id')
  @UseGuards(JwtAuthGuard, EmulateRLSGuard)
  async updateProfile(
    @Param('id') id: string,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return await this.authService.updateProfile(id, updateProfileDto);
  }

  @Post('roles')
  @UseGuards(JwtAuthGuard)
  async assignRole(@Body() assignRoleDto: AssignRoleDto, @Request() req: any) {
    // Only admins can assign roles
    const isAdmin = await this.authService.isAdmin(req.user.userId);
    if (!isAdmin) {
      throw new Error('Only admins can assign roles');
    }
    return await this.authService.assignRole(assignRoleDto);
  }

  @Get('roles/:userId')
  @UseGuards(JwtAuthGuard, EmulateRLSGuard)
  async getUserRoles(@Param('userId') userId: string) {
    return await this.authService.getUserRoles(userId);
  }
}

