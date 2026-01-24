import { Controller, Get, Post, Put, Delete, Body, UseGuards, Request, Param, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from '../storage/storage.service';
import { AuthService } from './auth.service';
import { ValidateTokenDto } from './dto/auth.dto';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { SignUpDto, SignInDto } from './dto/signup.dto';
import { RequestResetDto, ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './jwt.guard';
import { EmulateRLSGuard } from './guards/rls.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService, private storageService: StorageService) {}

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

  // Convenience endpoint to update current user's profile
  @Put('profile')
  @UseGuards(JwtAuthGuard)
  async updateMyProfile(@Request() req: any, @Body() updateProfileDto: UpdateProfileDto) {
    return await this.authService.updateProfile(req.user.userId, updateProfileDto);
  }

  // Upload avatar for current user
  @Post('avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(@Request() req: any, @UploadedFile() file: any) {
    const url = await this.storageService.saveAvatar(req.user.userId, file);
    await this.authService.updateProfile(req.user.userId, { avatar_url: url } as any);
    return { url };
  }

  // Delete avatar reference (optional deletion from storage handled elsewhere)
  @Delete('avatar')
  @UseGuards(JwtAuthGuard)
  async deleteAvatar(@Request() req: any) {
    await this.authService.updateProfile(req.user.userId, { avatar_url: null } as any);
    return { success: true };
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

  // Request a password reset token
  @Post('request-reset')
  async requestReset(@Body() dto: RequestResetDto) {
    return await this.authService.requestResetPassword(dto);
  }

  // Perform password reset using token
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return await this.authService.resetPassword(dto);
  }
}

