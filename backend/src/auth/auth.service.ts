import { Injectable, UnauthorizedException, NotFoundException, ConflictException, InternalServerErrorException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as nodemailer from 'nodemailer';
import { Profile } from './entities/profile.entity';
import { UserRole, AppRole } from './entities/user-role.entity';
import { User } from './entities/user.entity';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { UserPayloadDto } from './dto/auth.dto';
import { SignUpDto, SignInDto } from './dto/signup.dto';
import { RequestResetDto, ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectRepository(Profile)
    private profileRepository: Repository<Profile>,
    @InjectRepository(UserRole)
    private userRoleRepository: Repository<UserRole>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Validate JWT token
   */
  validateToken(token: string): any {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Decode JWT token without verification
   */
  decodeToken(token: string): any {
    try {
      return this.jwtService.decode(token);
    } catch (error) {
      throw new UnauthorizedException('Invalid token format');
    }
  }

  /**
   * Alias for decodeToken to match checklist naming
   */
  decodeJWT(token: string): any {
    return this.decodeToken(token);
  }

  /**
   * Get user info from token
   */
  getUserFromToken(token: string): UserPayloadDto {
    const payload = this.validateToken(token);
    return {
      userId: payload.sub || payload.user_id,
      email: payload.email,
      role: payload.role || 'user',
      aud: payload.aud,
      raw: payload,
    } as UserPayloadDto;
  }

  /**
   * Generate JWT token (for custom auth)
   */
  generateToken(userId: string, email: string, role: string = 'user'): string {
    const payload = {
      sub: userId,
      email,
      role,
      aud: 'authenticated',
    };
    return this.jwtService.sign(payload);
  }

  /**
   * Get profile by ID
   */
  async getProfile(userId: string): Promise<Profile> {
    const profile = await this.profileRepository.findOne({ where: { id: userId } });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }
    return profile;
  }

  /**
   * Create new profile
   */
  async createProfile(createProfileDto: CreateProfileDto): Promise<Profile> {
    const profile = this.profileRepository.create(createProfileDto);
    return await this.profileRepository.save(profile);
  }

  /**
   * Update profile
   */
  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto): Promise<Profile> {
    const profile = await this.getProfile(userId);
    Object.assign(profile, updateProfileDto);
    return await this.profileRepository.save(profile);
  }

  /**
   * Get user roles
   */
  async getUserRoles(userId: string): Promise<UserRole[]> {
    return await this.userRoleRepository.find({ where: { user_id: userId } });
  }

  /**
   * Check if user has role
   */
  async hasRole(userId: string, role: AppRole): Promise<boolean> {
    const userRole = await this.userRoleRepository.findOne({
      where: { user_id: userId, role },
    });
    return !!userRole;
  }

  /**
   * Check if user is admin
   */
  async isAdmin(userId: string): Promise<boolean> {
    return await this.hasRole(userId, AppRole.ADMIN);
  }

  /**
   * Assign role to user
   */
  async assignRole(assignRoleDto: AssignRoleDto): Promise<UserRole> {
    const existingRole = await this.userRoleRepository.findOne({
      where: { user_id: assignRoleDto.user_id, role: assignRoleDto.role },
    });

    if (existingRole) {
      return existingRole;
    }

    const userRole = this.userRoleRepository.create(assignRoleDto);
    return await this.userRoleRepository.save(userRole);
  }

  /**
   * Remove role from user
   */
  async removeRole(userId: string, role: AppRole): Promise<void> {
    await this.userRoleRepository.delete({ user_id: userId, role });
  }

  /**
   * Sign up new user
   */
  async signUp(signUpDto: SignUpDto): Promise<{ user: User; token: string }> {
    try {
      const existingUser = await this.userRepository.findOne({ where: { email: signUpDto.email } });
      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(signUpDto.password, salt);

      const user = this.userRepository.create({
        email: signUpDto.email,
        password_hash,
        full_name: signUpDto.full_name || '',
        email_verified: false,
      });

      const savedUser = await this.userRepository.save(user);

      // Create profile
      await this.profileRepository.save({
        id: savedUser.id,
        email: savedUser.email,
        full_name: savedUser.full_name,
      });

      // Assign default user role
      await this.assignRole({ user_id: savedUser.id, role: AppRole.USER });

      // Welcome email should not block signup success.
      try {
        await this.sendWelcomeEmail(savedUser.email, savedUser.full_name || savedUser.email);
      } catch (error) {
        this.logger.warn(`Welcome email failed for ${savedUser.email}: ${error instanceof Error ? error.message : String(error)}`);
      }

      const token = this.generateToken(savedUser.id, savedUser.email, AppRole.USER);

      return { user: savedUser, token };
    } catch (err) {
      // Surface the underlying error for diagnostics while preserving HTTP error handling
      // eslint-disable-next-line no-console
      console.error('[auth-signup-service-error]', (err as any)?.message || err, (err as any)?.stack || '');
      throw err;
    }
  }

  /**
   * Sign in user
   */
  async signIn(signInDto: SignInDto): Promise<{ user: User; token: string }> {
    const user = await this.userRepository.findOne({ where: { email: signInDto.email } });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(signInDto.password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const roles = await this.getUserRoles(user.id);
    const role = roles.length > 0 ? roles[0].role : AppRole.USER;

    const token = this.generateToken(user.id, user.email, role);

    return { user, token };
  }

  /**
   * Issue a password reset token (to be emailed to user)
   */
  async requestResetPassword(dto: RequestResetDto): Promise<{ success: boolean }> {
    const user = await this.userRepository.findOne({ where: { email: dto.email } });
    if (!user) {
      // Do not reveal existence
      return { success: true };
    }
    const token = this.jwtService.sign({ email: user.email, type: 'reset' }, { expiresIn: '30m' });
    await this.sendPasswordResetEmail(user.email, token);
    return { success: true };
  }

  private async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = Number(this.configService.get<string>('SMTP_PORT') || '587');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS') || this.configService.get<string>('SMTP_PASSWORD');
    const from = this.configService.get<string>('MAIL_FROM') || this.configService.get<string>('SMTP_FROM') || 'Poscal <noreply@poscalfx.com>';
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://poscalfx.com';

    if (!host || !port || !user || !pass) {
      throw new InternalServerErrorException('Email service is not configured');
    }

    const secure = port === 465;
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    const resetUrl = `${frontendUrl.replace(/\/$/, '')}/reset-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;

    try {
      await transporter.sendMail({
        from,
        to: email,
        subject: 'Reset your Poscal password',
        text: `You requested a password reset for Poscal.\n\nUse this link to reset your password:\n${resetUrl}\n\nThis link expires in 30 minutes.\nIf you did not request this, you can ignore this email.`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #111;">
            <h2 style="margin: 0 0 12px;">Reset your Poscal password</h2>
            <p>You requested a password reset for your Poscal account.</p>
            <p style="margin: 20px 0;">
              <a href="${resetUrl}" style="background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block;">
                Reset Password
              </a>
            </p>
            <p>This link expires in <strong>30 minutes</strong>.</p>
            <p>If you did not request this, you can ignore this email.</p>
          </div>
        `,
      });
    } catch (error) {
      this.logger.error('Failed to send password reset email', error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Unable to send reset email');
    }
  }

  private async sendWelcomeEmail(email: string, recipientName: string): Promise<void> {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = Number(this.configService.get<string>('SMTP_PORT') || '587');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS') || this.configService.get<string>('SMTP_PASSWORD');
    const from = this.configService.get<string>('MAIL_FROM') || this.configService.get<string>('SMTP_FROM') || 'Poscal <noreply@poscalfx.com>';
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://poscalfx.com';

    if (!host || !port || !user || !pass) {
      throw new InternalServerErrorException('Email service is not configured');
    }

    const secure = port === 465;
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    const signInUrl = `${frontendUrl.replace(/\/$/, '')}/signin`;

    await transporter.sendMail({
      from,
      to: email,
      subject: 'Welcome to Poscal',
      text: `Hi ${recipientName},\n\nWelcome to Poscal. Your account is ready.\n\nSign in: ${signInUrl}\n\n— Poscal Team`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #111;">
          <h2 style="margin: 0 0 12px;">Welcome to Poscal</h2>
          <p>Hi ${recipientName},</p>
          <p>Your account has been created successfully.</p>
          <p style="margin: 20px 0;">
            <a href="${signInUrl}" style="background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block;">
              Sign In
            </a>
          </p>
          <p>We are glad to have you onboard.</p>
          <p>— Poscal Team</p>
        </div>
      `,
    });
  }

  /**
   * Reset password using token
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ success: boolean }> {
    try {
      const payload = this.jwtService.verify(dto.token);
      if (payload.type !== 'reset' || payload.email !== dto.email) {
        throw new UnauthorizedException('Invalid reset token');
      }
      const user = await this.userRepository.findOne({ where: { email: dto.email } });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      const salt = await bcrypt.genSalt(10);
      user.password_hash = await bcrypt.hash(dto.new_password, salt);
      await this.userRepository.save(user);
      return { success: true };
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
