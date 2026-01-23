import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profile } from './entities/profile.entity';
import { UserRole, AppRole } from './entities/user-role.entity';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AssignRoleDto } from './dto/assign-role.dto';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    @InjectRepository(Profile)
    private profileRepository: Repository<Profile>,
    @InjectRepository(UserRole)
    private userRoleRepository: Repository<UserRole>,
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
   * Get user info from token
   */
  getUserFromToken(token: string): any {
    const payload = this.validateToken(token);
    return {
      userId: payload.sub || payload.user_id,
      email: payload.email,
      role: payload.role || 'user',
      aud: payload.aud,
    };
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
}

