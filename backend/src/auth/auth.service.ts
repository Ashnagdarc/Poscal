import { Injectable, UnauthorizedException, NotFoundException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
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
  constructor(
    private jwtService: JwtService,
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
  async requestResetPassword(dto: RequestResetDto): Promise<{ token: string }> {
    const user = await this.userRepository.findOne({ where: { email: dto.email } });
    if (!user) {
      // Do not reveal existence
      return { token: '' };
    }
    const token = this.jwtService.sign({ email: user.email, type: 'reset' }, { expiresIn: '30m' });
    return { token };
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

