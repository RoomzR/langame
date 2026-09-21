import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';
import { AgentService } from '../agent/agent.service';
import {
  ALL_TABS,
  ASSIGNABLE_CLUB_ROLES,
  canHireRole,
  DEFAULT_TABS,
  ROLE_LABELS,
  tabsForRole,
  type RoleName,
} from '../../common/acl';

@Injectable()
export class OpsService {
  constructor(
    private prisma: PrismaService,
    private agents: AgentService,
  ) {}

  async actorRole(clubId: string, user: AuthUser): Promise<RoleName> {
    if (user.globalRole === UserRole.SUPERADMIN) return 'SUPERADMIN';
    if (user.globalRole === UserRole.SUPPORT) return 'SUPPORT';
    const row = await this.prisma.userClubRole.findUnique({
      where: { userId_clubId: { userId: user.id, clubId } },
    });
    return (row?.role as RoleName) ?? 'GUEST';
  }

  async access(clubId: string, user: AuthUser) {
    const role = await this.actorRole(clubId, user);
    const club = await this.prisma.club.findUnique({ where: { id: clubId }, select: { settings: true, name: true } });
    const matrix = ((club?.settings as Record<string, unknown> | null)?.rightsMatrix ?? null) as Record<string, string[]> | null;
    const tabs = tabsForRole(role, matrix);
    return {
      clubId,
      name: club?.name,
      role,
      label: ROLE_LABELS[role],
      tabs,
      canEditRights: role === 'OWNER' || role === 'SUPERADMIN',
      canHire: canHireRole(role, 'CASHIER'),
      matrix: matrix ?? {},
      defaults: DEFAULT_TABS,
      labels: ROLE_LABELS,
      allTabs: ALL_TABS,
    };
  }

  async patchRights(clubId: string, user: AuthUser, matrix: Record<string, string[]>) {
    const role = await this.actorRole(clubId, user);
    if (role !== 'OWNER' && role !== 'SUPERADMIN') throw new ForbiddenException({ code: 'FORBIDDEN' });
    const clean: Record<string, string[]> = {};
    for (const key of ASSIGNABLE_CLUB_ROLES) {
      if (key === 'OWNER') continue;
      const tabs = (matrix[key] ?? []).filter((t) => ALL_TABS.includes(t) && t !== 'dashnet');
      clean[key] = [...new Set(tabs)];
    }
    const club = await this.prisma.club.findUnique({ where: { id: clubId } });
    if (!club) throw new NotFoundException({ code: 'CLUB_NOT_FOUND' });
    const prev = (club.settings as Record<string, unknown>) ?? {};
    return this.prisma.club.update({
      where: { id: clubId },
      data: { settings: { ...prev, rightsMatrix: clean } as Prisma.InputJsonValue },
      select: { id: true, settings: true },
    });
  }

  settings(clubId: string) {
    return this.prisma.club.findUnique({
      where: { id: clubId },
      select: { id: true, settings: true, modules: true, name: true },
    });
  }

  async patchSettings(clubId: string, patch: Record<string, unknown>) {
    const club = await this.prisma.club.findUnique({ where: { id: clubId } });
    if (!club) throw new NotFoundException({ code: 'CLUB_NOT_FOUND' });
    const prev = (club.settings as Record<string, unknown>) ?? {};
    const updated = await this.prisma.club.update({
      where: { id: clubId },
      data: { settings: { ...prev, ...patch } as Prisma.InputJsonValue },
      select: { id: true, settings: true },
    });
    await this.agents.onSettingsChanged(clubId, patch).catch(() => undefined);
    return updated;
  }

  pcTypes(clubId: string) {
    return this.prisma.pcType.findMany({
      where: { clubId },
      include: { _count: { select: { seats: true } } },
    });
  }

  createPcType(clubId: string, name: string) {
    return this.prisma.pcType.create({ data: { clubId, name } });
  }

  bindSeat(seatId: string, pcTypeId: string | null) {
    return this.prisma.seat.update({ where: { id: seatId }, data: { pcTypeId } });
  }

  async staff(clubId: string, dismissed = false) {
    if (dismissed) {
      const rows = await this.prisma.staffProfile.findMany({
        where: { clubId, status: 'DISMISSED' },
        include: { user: { select: { id: true, displayName: true, phone: true } } },
        orderBy: { dismissedAt: 'desc' },
      });
      return rows.map((p, i) => ({
        id: p.user.id,
        n: i + 1,
        displayName: p.user.displayName,
        phone: p.user.phone,
        role: '',
        login: p.login || p.user.phone,
        status: p.status,
        workPoint: p.workPoint,
        schedule: p.schedule,
        wageKopecks: p.wageKopecks,
        dismissedAt: p.dismissedAt,
        firstShiftAt: p.firstShiftAt,
        shiftOpen: null,
      }));
    }
    const rows = await this.prisma.userClubRole.findMany({
      where: { clubId, role: { in: ASSIGNABLE_CLUB_ROLES as UserRole[] } },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            phone: true,
            staffProfiles: { where: { clubId }, take: 1 },
            shifts: { where: { clubId, status: 'OPEN' }, take: 1, orderBy: { startedAt: 'desc' } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows
      .map((r, i) => {
        const p = r.user.staffProfiles[0];
        return {
          id: r.user.id,
          n: i + 1,
          displayName: r.user.displayName,
          phone: r.user.phone,
          role: r.role,
          login: p?.login || r.user.phone,
          status: p?.status ?? 'ACTIVE',
          workPoint: p?.workPoint ?? '',
          schedule: p?.schedule ?? 'День',
          wageKopecks: p?.wageKopecks ?? 0,
          dismissedAt: p?.dismissedAt ?? null,
          firstShiftAt: p?.firstShiftAt ?? r.createdAt,
          shiftOpen: r.user.shifts[0]?.startedAt ?? null,
        };
      })
      .filter((r) => (dismissed ? r.status === 'DISMISSED' : r.status !== 'DISMISSED'));
  }

  async upsertStaff(
    clubId: string,
    actor: AuthUser,
    dto: {
      phone: string;
      displayName: string;
      password: string;
      role: string;
      login?: string;
      workPoint?: string;
      schedule?: string;
      wageKopecks?: number;
    },
  ) {
    const actorRole = await this.actorRole(clubId, actor);
    if (!canHireRole(actorRole, dto.role as RoleName)) throw new ForbiddenException({ code: 'FORBIDDEN' });
    let user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phone: dto.phone,
          displayName: dto.displayName,
          passwordHash: await bcrypt.hash(dto.password, 10),
          globalRole: UserRole.GUEST,
          wallet: { create: { balanceKopecks: 0 } },
        },
      });
    } else if (user.globalRole === UserRole.SUPERADMIN || user.globalRole === UserRole.SUPPORT) {
      throw new BadRequestException({ code: 'ROLE_LOCKED' });
    }
    await this.prisma.userClubRole.upsert({
      where: { userId_clubId: { userId: user.id, clubId } },
      create: { userId: user.id, clubId, role: dto.role as UserRole },
      update: { role: dto.role as UserRole },
    });
    await this.prisma.staffProfile.upsert({
      where: { clubId_userId: { clubId, userId: user.id } },
      create: {
        clubId,
        userId: user.id,
        login: dto.login || dto.phone,
        workPoint: dto.workPoint ?? '',
        schedule: dto.schedule ?? 'День',
        wageKopecks: dto.wageKopecks ?? 0,
        status: 'ACTIVE',
      },
      update: {
        login: dto.login || undefined,
        workPoint: dto.workPoint,
        schedule: dto.schedule,
        wageKopecks: dto.wageKopecks,
        status: 'ACTIVE',
        dismissedAt: null,
      },
    });
    return { ok: true, userId: user.id };
  }

  async dismissStaff(clubId: string, actor: AuthUser, userId: string) {
    const actorRole = await this.actorRole(clubId, actor);
    const row = await this.prisma.userClubRole.findUnique({ where: { userId_clubId: { userId, clubId } } });
    if (!row) throw new NotFoundException({ code: 'STAFF_NOT_FOUND' });
    if (!canHireRole(actorRole, row.role as RoleName) && actorRole !== 'OWNER' && actorRole !== 'SUPERADMIN') {
      throw new ForbiddenException({ code: 'FORBIDDEN' });
    }
    if (row.role === UserRole.OWNER) {
      const owners = await this.prisma.userClubRole.count({ where: { clubId, role: UserRole.OWNER } });
      if (owners <= 1) throw new BadRequestException({ code: 'LAST_OWNER' });
    }
    await this.prisma.staffProfile.upsert({
      where: { clubId_userId: { clubId, userId } },
      create: { clubId, userId, status: 'DISMISSED', dismissedAt: new Date() },
      update: { status: 'DISMISSED', dismissedAt: new Date() },
    });
    await this.prisma.userClubRole.deleteMany({ where: { clubId, userId } });
    return { ok: true };
  }

  groups(clubId: string) {
    return this.prisma.guestGroup.findMany({ where: { clubId }, orderBy: { name: 'asc' } });
  }

  createGroup(clubId: string, name: string) {
    return this.prisma.guestGroup.create({ data: { clubId, name } });
  }

  autobonus(clubId: string) {
    return this.prisma.autobonusRule.findMany({ where: { clubId } });
  }

  createAutobonus(clubId: string, dto: { name: string; percent: number; minSpendKopecks?: number }) {
    return this.prisma.autobonusRule.create({ data: { clubId, ...dto } });
  }

  blacklist(clubId: string) {
    return this.prisma.phoneBlacklist.findMany({ where: { clubId }, orderBy: { createdAt: 'desc' } });
  }

  addBlacklist(clubId: string, phone: string, reason: string) {
    return this.prisma.phoneBlacklist.create({ data: { clubId, phone, reason } });
  }

  certs(clubId: string) {
    return this.prisma.giftCertificate.findMany({ where: { clubId }, orderBy: { createdAt: 'desc' } });
  }

  createCert(clubId: string, amountKopecks: number, code?: string) {
    return this.prisma.giftCertificate.create({
      data: {
        clubId,
        amountKopecks,
        code: code || `RD-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      },
    });
  }

  promos(clubId: string) {
    return this.prisma.promoCode.findMany({ where: { clubId }, orderBy: { code: 'asc' } });
  }

  createPromo(clubId: string, code: string, percent: number) {
    return this.prisma.promoCode.create({ data: { clubId, code, percent, active: true } });
  }

  events(clubId: string, kind?: string) {
    return this.prisma.guestEvent.findMany({
      where: { clubId, ...(kind ? { kind } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { displayName: true, phone: true } } },
    });
  }

  logEvent(clubId: string, kind: string, payload: Prisma.InputJsonValue, userId?: string, actorId?: string) {
    return this.prisma.guestEvent.create({ data: { clubId, kind, payload, userId, actorId } });
  }

  tickets(clubId: string) {
    return this.prisma.shiftTicket.findMany({
      where: { clubId },
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { displayName: true } } },
    });
  }

  createTicket(clubId: string, userId: string, title: string, body: string) {
    return this.prisma.shiftTicket.create({ data: { clubId, createdById: userId, title, body } });
  }

  resolveTicket(id: string) {
    return this.prisma.shiftTicket.update({ where: { id }, data: { status: 'RESOLVED' } });
  }

  commands(clubId: string) {
    return this.agents.listCommands(clubId);
  }

  enqueueCommand(clubId: string, command: string, seatId?: string, payload: object = {}) {
    return this.agents.enqueue(clubId, command, seatId, payload as Prisma.InputJsonValue);
  }

  pairSeat(clubId: string, seatId: string) {
    return this.agents.pair(clubId, seatId);
  }

  async payroll(clubId: string) {
    const staff = await this.staff(clubId, false);
    const shifts = await this.prisma.shift.findMany({
      where: { clubId, startedAt: { gte: new Date(Date.now() - 30 * 86400_000) } },
    });
    return staff.map((s) => {
      const mine = shifts.filter((x) => x.userId === s.id);
      const hours = mine.reduce((a, sh) => {
        const end = (sh.endedAt ?? new Date()).getTime();
        return a + Math.max(0, (end - sh.startedAt.getTime()) / 3600_000);
      }, 0);
      return {
        ...s,
        hours: Math.round(hours * 10) / 10,
        payKopecks: Math.round(hours * (s.wageKopecks || 0)),
      };
    });
  }

  async guestTable(
    clubId: string,
    q?: { q?: string; groupId?: string; from?: string; to?: string },
  ) {
    const users = await this.prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { clubRoles: { some: { clubId } } },
              { sessions: { some: { clubId } } },
              { bookings: { some: { clubId } } },
              { cashReceived: { some: { clubId } } },
            ],
          },
          q?.q
            ? {
                OR: [
                  { phone: { contains: q.q } },
                  { displayName: { contains: q.q, mode: 'insensitive' } },
                ],
              }
            : {},
        ],
      },
      take: 300,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        displayName: true,
        phone: true,
        createdAt: true,
        wallet: true,
        guestProfiles: { where: { clubId }, include: { group: true }, take: 1 },
        sessions: { where: { clubId }, orderBy: { startedAt: 'desc' }, take: 1, select: { startedAt: true } },
      },
    });
    return users
      .map((u) => {
        const p = u.guestProfiles[0];
        return {
          id: u.id,
          displayName: u.displayName,
          phone: u.phone.startsWith('walkin:') ? '' : u.phone,
          walkIn: u.phone.startsWith('walkin:'),
          group: p?.group?.name ?? 'Стандарт',
          groupId: p?.groupId ?? '',
          gender: p?.gender ?? '',
          birthday: p?.birthday ?? null,
          document: p?.document ?? '',
          balanceKopecks: u.wallet?.balanceKopecks ?? 0,
          bonusKopecks: u.wallet?.bonusKopecks ?? 0,
          lastAuth: u.sessions[0]?.startedAt ?? null,
          createdAt: u.createdAt,
        };
      })
      .filter((u) => (q?.groupId ? u.groupId === q.groupId : true));
  }

  async quote(clubId: string, seatId: string, tariffId: string, startsAt: string, endsAt: string) {
    const tariff = await this.prisma.tariff.findFirst({ where: { id: tariffId, clubId } });
    if (!tariff) throw new NotFoundException({ code: 'TARIFF_NOT_FOUND' });
    const seat = await this.prisma.seat.findFirst({ where: { id: seatId, clubId } });
    if (!seat) throw new NotFoundException({ code: 'SEAT_NOT_FOUND' });
    const ms = new Date(endsAt).getTime() - new Date(startsAt).getTime();
    if (ms <= 0) throw new BadRequestException({ code: 'INVALID_RANGE' });
    const hours = ms / 3600_000;
    const settings = ((await this.settings(clubId))?.settings as Record<string, any>) ?? {};
    const dyn = Number(settings.dynMarkupPct ?? 0);
    const amount = Math.round(tariff.pricePerHourKopecks * hours * (1 + dyn / 100));
    return {
      seat: seat.label,
      tariff: tariff.name,
      hours: Math.round(hours * 100) / 100,
      amountKopecks: amount,
      amountLabel: `${(amount / 100).toFixed(2)} Br`,
    };
  }
}
