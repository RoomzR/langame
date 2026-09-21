import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const CLUB_ROLES_KEY = 'clubRoles';
export const RequireClubRole = (...roles: UserRole[]) => SetMetadata(CLUB_ROLES_KEY, roles);

export const CLUB_SECTIONS_KEY = 'clubSections';
export const RequireSection = (...sections: string[]) => SetMetadata(CLUB_SECTIONS_KEY, sections);

export const STAFF_ANY_KEY = 'staffAny';
export const StaffAny = () => SetMetadata(STAFF_ANY_KEY, true);

export const GLOBAL_ROLES_KEY = 'globalRoles';
export const RequireGlobalRole = (...roles: UserRole[]) => SetMetadata(GLOBAL_ROLES_KEY, roles);

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return req.user as AuthUser;
});

export type AuthUser = {
  id: string;
  phone: string;
  globalRole: UserRole;
  locale: string;
};
