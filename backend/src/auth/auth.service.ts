import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

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
}
