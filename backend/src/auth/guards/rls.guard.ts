import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AppRole } from '../entities/user-role.entity';

@Injectable()
export class EmulateRLSGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const resourceUserId =
      request.params?.userId ??
      request.params?.id ??
      request.body?.userId ??
      request.body?.id;

    if (!user) {
      throw new ForbiddenException('Missing authenticated user');
    }

    if (user.role === AppRole.ADMIN) {
      return true;
    }

    if (resourceUserId && resourceUserId !== user.userId) {
      throw new ForbiddenException('RLS emulation: access denied');
    }

    return true;
  }
}
