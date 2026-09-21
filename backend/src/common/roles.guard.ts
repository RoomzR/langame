import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { GLOBAL_ROLES_KEY } from './decorators';

@Injectable()
export class GlobalRoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(GLOBAL_ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles?.length) return true;
    const user = ctx.switchToHttp().getRequest().user;
    if (!user) throw new ForbiddenException({ code: 'FORBIDDEN' });
    if (user.globalRole === UserRole.SUPERADMIN) return true;
    if (!roles.includes(user.globalRole)) throw new ForbiddenException({ code: 'FORBIDDEN' });
    return true;
  }
}
