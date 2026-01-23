import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ServiceTokenGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-service-token'];
    const validToken = this.configService.get<string>('SERVICE_TOKEN');

    if (!validToken) {
      throw new UnauthorizedException('Service token not configured');
    }

    if (!token || token !== validToken) {
      throw new UnauthorizedException('Invalid service token');
    }

    return true;
  }
}
