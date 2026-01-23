import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { Profile } from './entities/profile.entity';
import { UserRole } from './entities/user-role.entity';
import { ServiceTokenGuard } from './guards/service-token.guard';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Profile, UserRole]),
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET') || 'your-secret-key-change-in-production',
        signOptions: {
          expiresIn: '24h',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, ServiceTokenGuard],
  exports: [AuthService, JwtModule, PassportModule, TypeOrmModule, ServiceTokenGuard],
})
export class AuthModule {}
