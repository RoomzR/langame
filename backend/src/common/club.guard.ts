import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CLUB_ROLES_KEY, CLUB_SECTIONS_KEY, STAFF_ANY_KEY } from './decorators';
import {
  CLUB_STAFF_ROLES,
  canAccessTab,
  isClubStaffRole,
  sectionsFromPath,
  type RoleName,
} from './acl';

@Injectable()
export class ClubGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<UserRole[]>(CLUB_ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    const staffAny = this.reflector.getAllAndOverride<boolean>(STAFF_ANY_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    const explicitSections = this.reflector.getAllAndOverride<string[]>(CLUB_SECTIONS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required?.length && !staffAny && !explicitSections?.length) return true;

    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user) throw new ForbiddenException({ code: 'FORBIDDEN' });
    if (user.globalRole === UserRole.SUPERADMIN) {
      req.clubRole = UserRole.SUPERADMIN;
      return true;
    }

    const clubId = await this.resolveClubId(req);
    if (!clubId) throw new ForbiddenException({ code: 'CLUB_REQUIRED' });

    const membership = await this.prisma.userClubRole.findUnique({
      where: { userId_clubId: { userId: user.id, clubId } },
    });
    const profile = await this.prisma.staffProfile.findUnique({
      where: { clubId_userId: { clubId, userId: user.id } },
    });
    if (profile?.status === 'DISMISSED') throw new ForbiddenException({ code: 'STAFF_DISMISSED' });

    const global = user.globalRole as RoleName;
    let role: RoleName | null = null;
    if (global === 'SUPPORT') role = 'SUPPORT';
    else if (membership && isClubStaffRole(membership.role)) role = membership.role as RoleName;

    if (!role) throw new ForbiddenException({ code: 'FORBIDDEN' });

    const allowedRoles: string[] = staffAny
      ? [...CLUB_STAFF_ROLES, 'SUPPORT']
      : required?.length
        ? this.expandRoles(required)
        : [...CLUB_STAFF_ROLES, 'SUPPORT'];

    if (!allowedRoles.includes(role)) throw new ForbiddenException({ code: 'FORBIDDEN' });

    const path = String(req.originalUrl || req.url || '');
    const sections = explicitSections?.length ? explicitSections : sectionsFromPath(req.method, path);
    if (sections.length) {
      const club = await this.prisma.club.findUnique({ where: { id: clubId }, select: { settings: true } });
      const matrix = ((club?.settings as Record<string, unknown> | null)?.rightsMatrix ?? null) as
        | Record<string, string[]>
        | null;
      const ok = sections.some((tab) => canAccessTab(role!, tab, matrix));
      if (!ok) throw new ForbiddenException({ code: 'FORBIDDEN' });
    }

    req.clubId = clubId;
    req.clubRole = role;
    return true;
  }

  private expandRoles(roles: UserRole[]): string[] {
    const names = roles as string[];
    const legacyStaff = names.includes('OWNER') && names.includes('CLUB_ADMIN');
    if (legacyStaff) return [...CLUB_STAFF_ROLES, 'SUPPORT'];
    return names;
  }

  private async resolveClubId(req: any): Promise<string | undefined> {
    if (req.params?.clubId) return req.params.clubId;
    if (req.body?.clubId) return req.body.clubId;
    if (req.params?.seatId) {
      const seat = await this.prisma.seat.findUnique({ where: { id: req.params.seatId } });
      return seat?.clubId;
    }
    if (req.params?.sessionId) {
      const session = await this.prisma.session.findUnique({ where: { id: req.params.sessionId } });
      return session?.clubId;
    }
    if (req.params?.bookingId) {
      const booking = await this.prisma.booking.findUnique({ where: { id: req.params.bookingId } });
      return booking?.clubId;
    }
    if (req.params?.zoneId) {
      const zone = await this.prisma.zone.findUnique({ where: { id: req.params.zoneId } });
      return zone?.clubId;
    }
    if (req.params?.tournamentId) {
      const t = await this.prisma.tournament.findUnique({ where: { id: req.params.tournamentId } });
      return t?.clubId;
    }
    return undefined;
  }
}
