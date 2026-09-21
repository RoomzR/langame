import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async overview(clubId: string, from?: Date, to?: Date) {
    const start = from ?? startOfToday();
    const end = to ?? new Date();
    const [seats, active, sessions, bar, seatGroups, wallets, cashIn, bonusTx, openShift, heartbeats] =
      await Promise.all([
      this.prisma.seat.count({ where: { clubId } }),
      this.prisma.session.count({ where: { clubId, status: { in: ['ACTIVE', 'PAUSED'] } } }),
      this.prisma.session.findMany({
        where: { clubId, startedAt: { gte: start, lte: end } },
        select: {
          totalChargedKopecks: true,
          accumulatedActiveSeconds: true,
          userId: true,
          endedAt: true,
        },
      }),
      this.prisma.order.aggregate({
        where: { clubId, createdAt: { gte: start, lte: end } },
        _sum: { totalKopecks: true },
      }),
      this.prisma.seat.groupBy({ by: ['status'], where: { clubId }, _count: { _all: true } }),
      this.prisma.wallet.aggregate({
        _sum: { balanceKopecks: true, bonusKopecks: true },
      }),
      this.prisma.cashOperation.aggregate({
        where: { clubId, status: 'POSTED', createdAt: { gte: start, lte: end } },
        _sum: { amountKopecks: true },
        _count: true,
      }),
      this.prisma.transaction.aggregate({
        where: { type: 'BONUS', createdAt: { gte: start, lte: end } },
        _sum: { amountKopecks: true },
        _count: true,
      }),
      this.prisma.shift.findFirst({
        where: { clubId, status: 'OPEN' },
        include: { user: { select: { displayName: true, phone: true } } },
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.seatTelemetry.count({
        where: { seat: { clubId }, lastHeartbeatAt: { gte: new Date(Date.now() - 120_000) } },
      }),
    ]);
    const uniqueGuests = new Set(sessions.map((s) => s.userId)).size;
    const sessionRevenue = sessions.reduce((s, x) => s + x.totalChargedKopecks, 0);
    const avgDuration =
      sessions.length === 0
        ? 0
        : Math.round(sessions.reduce((s, x) => s + x.accumulatedActiveSeconds, 0) / sessions.length);
    const countStatus = (st: string) => {
      const row = seatGroups.find((g) => g.status === st);
      const c = row?._count as unknown as number | { _all: number };
      return typeof c === "number" ? c : c?._all ?? 0;
    };
    const free = countStatus('FREE');
    const maintenance = countStatus('MAINTENANCE');
    const offline = countStatus('OFFLINE');
    const reserved = countStatus('RESERVED');
    return {
      seats,
      occupied: active,
      free,
      maintenance,
      offline,
      reserved,
      connected: heartbeats,
      occupancyPct: seats ? Math.round((active / seats) * 100) : 0,
      loadDayPct: seats ? Math.round((sessions.length / Math.max(1, seats)) * 4) : 0,
      sessions: sessions.length,
      sessionsToday: sessions.length,
      uniqueGuests,
      sessionRevenueKopecks: sessionRevenue,
      barRevenueKopecks: bar._sum.totalKopecks ?? 0,
      expenseKopecks: 0,
      walletSumKopecks: wallets._sum.balanceKopecks ?? 0,
      bonusSumKopecks: wallets._sum.bonusKopecks ?? 0,
      cashPostedKopecks: cashIn._sum.amountKopecks ?? 0,
      cashPostedCount: cashIn._count,
      bonusGrantedKopecks: bonusTx._sum.amountKopecks ?? 0,
      bonusGrantedCount: bonusTx._count,
      avgSessionSeconds: avgDuration,
      avgSessionCheckKopecks: sessions.length ? Math.round(sessionRevenue / sessions.length) : 0,
      avgTopupKopecks: cashIn._count ? Math.round((cashIn._sum.amountKopecks ?? 0) / cashIn._count) : 0,
      avgBarCheckKopecks: 0,
      openShift: openShift
        ? {
            displayName: openShift.user.displayName,
            phone: openShift.user.phone,
            startedAt: openShift.startedAt,
            login: openShift.user.phone,
          }
        : null,
      from: start.toISOString(),
      to: end.toISOString(),
      currency: 'BYN',
    };
  }

  async occupancy(clubId: string, hours = 24) {
    const end = new Date();
    const start = new Date(end.getTime() - hours * 3600_000);
    const seats = await this.prisma.seat.count({ where: { clubId } });
    const sessions = await this.prisma.session.findMany({
      where: { clubId, startedAt: { lte: end }, OR: [{ endedAt: null }, { endedAt: { gte: start } }] },
      select: { startedAt: true, endedAt: true },
    });
    const buckets: { hour: string; occupied: number; occupancyPct: number }[] = [];
    for (let i = 0; i < hours; i++) {
      const bucketStart = new Date(start.getTime() + i * 3600_000);
      const bucketEnd = new Date(bucketStart.getTime() + 3600_000);
      const occupied = sessions.filter((s) => {
        const a = s.startedAt.getTime();
        const b = (s.endedAt ?? end).getTime();
        return a < bucketEnd.getTime() && b > bucketStart.getTime();
      }).length;
      buckets.push({
        hour: bucketStart.toISOString(),
        occupied,
        occupancyPct: seats ? Math.round((occupied / seats) * 100) : 0,
      });
    }
    return { seats, buckets };
  }

  async revenue(clubId: string, days = 7) {
    const end = new Date();
    const start = new Date(end.getTime() - days * 86400_000);
    const sessions = await this.prisma.session.findMany({
      where: { clubId, startedAt: { gte: start } },
      select: { startedAt: true, totalChargedKopecks: true },
    });
    const orders = await this.prisma.order.findMany({
      where: { clubId, createdAt: { gte: start } },
      select: { createdAt: true, totalKopecks: true },
    });
    const map = new Map<string, { session: number; bar: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(start.getTime() + i * 86400_000).toISOString().slice(0, 10);
      map.set(d, { session: 0, bar: 0 });
    }
    for (const s of sessions) {
      const d = s.startedAt.toISOString().slice(0, 10);
      const row = map.get(d) ?? { session: 0, bar: 0 };
      row.session += s.totalChargedKopecks;
      map.set(d, row);
    }
    for (const o of orders) {
      const d = o.createdAt.toISOString().slice(0, 10);
      const row = map.get(d) ?? { session: 0, bar: 0 };
      row.bar += o.totalKopecks;
      map.set(d, row);
    }
    return {
      currency: 'BYN',
      days: [...map.entries()].map(([date, v]) => ({
        date,
        sessionKopecks: v.session,
        barKopecks: v.bar,
        totalKopecks: v.session + v.bar,
      })),
    };
  }

  async retention(clubId: string) {
    const since = new Date(Date.now() - 30 * 86400_000);
    const grouped = await this.prisma.session.groupBy({
      by: ['userId'],
      where: { clubId, startedAt: { gte: since } },
      _count: { userId: true },
    });
    const guests = grouped.length;
    const returning = grouped.filter((g) => g._count.userId >= 2).length;
    return {
      windowDays: 30,
      guests,
      returning,
      retentionPct: guests ? Math.round((returning / guests) * 100) : 0,
    };
  }

  async visits(clubId: string, days = 30) {
    const end = new Date();
    const start = startOfDay(new Date(end.getTime() - (days - 1) * 86400_000));
    const sessions = await this.prisma.session.findMany({
      where: { clubId, startedAt: { gte: start, lte: end } },
      select: { startedAt: true, userId: true },
    });
    const firsts = await this.prisma.session.groupBy({
      by: ['userId'],
      where: { clubId },
      _min: { startedAt: true },
    });
    const firstDay = new Map(firsts.map((g) => [g.userId, g._min.startedAt?.toISOString().slice(0, 10)]));
    const map = emptyDayMap(start, days);
    for (const s of sessions) {
      const d = s.startedAt.toISOString().slice(0, 10);
      const row = map.get(d);
      if (!row) continue;
      row.visits += 1;
      row.guests.add(s.userId);
      if (firstDay.get(s.userId) === d) row.neu.add(s.userId);
    }
    const series = [...map.entries()].map(([date, v]) => ({
      date,
      visits: v.visits,
      uniqueGuests: v.guests.size,
      newGuests: v.neu.size,
    }));
    const totals = series.reduce(
      (a, d) => ({
        visits: a.visits + d.visits,
        uniqueGuests: a.uniqueGuests + d.uniqueGuests,
        newGuests: a.newGuests + d.newGuests,
      }),
      { visits: 0, uniqueGuests: 0, newGuests: 0 },
    );
    const uniquePeriod = new Set(sessions.map((s) => s.userId)).size;
    return { days: series, totals: { ...totals, uniquePeriod } };
  }

  async network(days = 30, grain?: string, date?: string) {
    const end = new Date();
    const start = startOfDay(new Date(end.getTime() - (days - 1) * 86400_000));
    const clubs = await this.prisma.club.findMany({
      select: { id: true, name: true, city: true, slug: true },
      orderBy: { name: 'asc' },
    });
    const [overviews, sessions, firsts, orders, cash, bonuses] = await Promise.all([
      Promise.all(clubs.map((c) => this.overview(c.id))),
      this.prisma.session.findMany({
        where: { startedAt: { gte: start, lte: end } },
        select: { startedAt: true, userId: true, clubId: true, totalChargedKopecks: true },
      }),
      this.prisma.session.groupBy({
        by: ['userId', 'clubId'],
        _min: { startedAt: true },
      }),
      this.prisma.order.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: { createdAt: true, clubId: true, totalKopecks: true },
      }),
      this.prisma.cashOperation.aggregate({
        where: { status: 'POSTED', createdAt: { gte: start, lte: end } },
        _sum: { amountKopecks: true },
        _count: true,
      }),
      this.prisma.transaction.aggregate({
        where: { type: 'BONUS', createdAt: { gte: start, lte: end } },
        _sum: { amountKopecks: true },
        _count: true,
      }),
    ]);
    const firstDay = new Map(firsts.map((g) => [`${g.clubId}:${g.userId}`, g._min.startedAt?.toISOString().slice(0, 10)]));
    const map = emptyDayMap(start, days);
    for (const s of sessions) {
      const d = s.startedAt.toISOString().slice(0, 10);
      const row = map.get(d);
      if (!row) continue;
      row.visits += 1;
      row.guests.add(s.userId);
      if (firstDay.get(`${s.clubId}:${s.userId}`) === d) row.neu.add(s.userId);
    }
    const series = [...map.entries()].map(([date, v]) => ({
      date,
      visits: v.visits,
      uniqueGuests: v.guests.size,
      newGuests: v.neu.size,
    }));
    const byClub = new Map<string, { visits: number; newGuests: number; revenueKopecks: number }>();
    for (const c of clubs) byClub.set(c.id, { visits: 0, newGuests: 0, revenueKopecks: 0 });
    for (const s of sessions) {
      const row = byClub.get(s.clubId);
      if (!row) continue;
      row.visits += 1;
      row.revenueKopecks += s.totalChargedKopecks;
      if (firstDay.get(`${s.clubId}:${s.userId}`) === s.startedAt.toISOString().slice(0, 10)) row.newGuests += 1;
    }
    for (const o of orders) {
      const row = byClub.get(o.clubId);
      if (row) row.revenueKopecks += o.totalKopecks;
    }
    const kpis = overviews.reduce(
      (a, o) => ({
        clubs: a.clubs + 1,
        seats: a.seats + o.seats,
        occupied: a.occupied + o.occupied,
        sessions: a.sessions + o.sessions,
        uniqueGuests: a.uniqueGuests + o.uniqueGuests,
        sessionRevenueKopecks: a.sessionRevenueKopecks + o.sessionRevenueKopecks,
        barRevenueKopecks: a.barRevenueKopecks + o.barRevenueKopecks,
      }),
      {
        clubs: 0,
        seats: 0,
        occupied: 0,
        sessions: 0,
        uniqueGuests: 0,
        sessionRevenueKopecks: 0,
        barRevenueKopecks: 0,
      },
    );
    return {
      kpis: {
        ...kpis,
        occupancyPct: kpis.seats ? Math.round((kpis.occupied / kpis.seats) * 100) : 0,
        visits: sessions.length,
        newGuests: new Set(
          sessions
            .filter((s) => firstDay.get(`${s.clubId}:${s.userId}`) === s.startedAt.toISOString().slice(0, 10))
            .map((s) => s.userId),
        ).size,
        uniquePeriod: new Set(sessions.map((s) => s.userId)).size,
        cashPostedKopecks: cash._sum.amountKopecks ?? 0,
        cashPostedCount: cash._count,
        bonusGrantedKopecks: bonuses._sum.amountKopecks ?? 0,
        bonusGrantedCount: bonuses._count,
        avgSessionCheckKopecks: sessions.length
          ? Math.round(kpis.sessionRevenueKopecks / sessions.length)
          : 0,
        avgTopupKopecks: cash._count ? Math.round((cash._sum.amountKopecks ?? 0) / cash._count) : 0,
        avgBarCheckKopecks: orders.length
          ? Math.round(orders.reduce((s, o) => s + o.totalKopecks, 0) / orders.length)
          : 0,
        registrations: kpis.uniqueGuests,
        uniqueSessions: new Set(sessions.map((s) => s.userId)).size,
        grain: grain ?? 'day',
        date: date ?? end.toISOString().slice(0, 10),
        currency: 'BYN',
      },
      series,
      clubs: clubs.map((c, i) => ({
        ...c,
        ...overviews[i],
        ...(byClub.get(c.id) ?? { visits: 0, newGuests: 0, revenueKopecks: 0 }),
      })),
    };
  }

  async shiftReport(clubId: string, shiftId?: string) {
    const shift = shiftId
      ? await this.prisma.shift.findFirst({ where: { id: shiftId, clubId } })
      : await this.prisma.shift.findFirst({
          where: { clubId, status: 'OPEN' },
          orderBy: { startedAt: 'desc' },
        });
    if (!shift) return { shift: null };
    const end = shift.endedAt ?? new Date();
    const overview = await this.overview(clubId, shift.startedAt, end);
    const actions = await this.prisma.adminActionLog.count({
      where: { clubId, createdAt: { gte: shift.startedAt, lte: end }, userId: shift.userId },
    });
    return { shift, overview, adminActions: actions };
  }

  async openShift(clubId: string, userId: string) {
    await this.prisma.shift.updateMany({
      where: { clubId, status: 'OPEN' },
      data: { status: 'CLOSED', endedAt: new Date() },
    });
    return this.prisma.shift.create({ data: { clubId, userId, status: 'OPEN' } });
  }

  async closeShift(clubId: string, shiftId: string, userId?: string, cash?: Record<string, string>) {
    const shift = await this.prisma.shift.update({
      where: { id: shiftId },
      data: { status: 'CLOSED', endedAt: new Date() },
    });
    if (userId) {
      await this.prisma.adminActionLog.create({
        data: { clubId, userId, action: 'SHIFT_CLOSE', payload: cash ?? {} },
      });
    }
    return shift;
  }

  listShifts(clubId: string) {
    return this.prisma.shift.findMany({
      where: { clubId },
      orderBy: { startedAt: 'desc' },
      take: 30,
      include: { user: { select: { displayName: true, phone: true } } },
    });
  }
}

function startOfToday() {
  return startOfDay(new Date());
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function emptyDayMap(start: Date, days: number) {
  const map = new Map<string, { visits: number; guests: Set<string>; neu: Set<string> }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86400_000).toISOString().slice(0, 10);
    map.set(d, { visits: 0, guests: new Set(), neu: new Set() });
  }
  return map;
}
