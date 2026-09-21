import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ClubQueryDto,
  CreateClubDto,
  CreateOrganizationDto,
  CreateSeatDto,
  CreateTariffDto,
  CreateZoneDto,
  UpdateClubDto,
  UpdateSeatDto,
} from './dto';
import { SeatStatus, UserRole } from '@prisma/client';
import { AuthUser } from '../../common/decorators';

@Injectable()
export class ClubService {
  constructor(private prisma: PrismaService) {}

  createOrg(dto: CreateOrganizationDto) {
    return this.prisma.organization.create({ data: dto });
  }

  async listClubs(query: ClubQueryDto) {
    const clubs = await this.prisma.club.findMany({
      where: {
        isPublished: true,
        city: query.city || undefined,
        OR: query.q
          ? [
              { name: { contains: query.q, mode: 'insensitive' } },
              { city: { contains: query.q, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: {
        seats: { select: { status: true } },
        tariffs: { where: { isActive: true }, select: { pricePerHourKopecks: true } },
        media: { orderBy: { sortOrder: 'asc' }, take: 1 },
      },
    });
    return clubs.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      city: c.city,
      address: c.address,
      lat: c.lat,
      lng: c.lng,
      ratingAvg: c.ratingAvg,
      ratingCount: c.ratingCount,
      amenities: c.amenities,
      coverUrl: c.media[0]?.url ?? null,
      currency: 'BYN',
      minPricePerHourKopecks: c.tariffs.length
        ? Math.min(...c.tariffs.map((t) => t.pricePerHourKopecks))
        : null,
      freeSeats: c.seats.filter((s) => s.status === SeatStatus.FREE).length,
      totalSeats: c.seats.length,
    }));
  }

  async getClub(idOrSlug: string) {
    const club = await this.prisma.club.findFirst({
      where: this.isUuid(idOrSlug)
        ? { OR: [{ id: idOrSlug }, { slug: idOrSlug }] }
        : { slug: idOrSlug },
      include: {
        zones: {
          orderBy: { sortOrder: 'asc' },
          include: { seats: { include: { hardwareProfile: true }, orderBy: { label: 'asc' } } },
        },
        tariffs: { where: { isActive: true }, orderBy: { pricePerHourKopecks: 'asc' } },
        media: { orderBy: { sortOrder: 'asc' } },
        reviews: { take: 20, orderBy: { createdAt: 'desc' }, include: { user: { select: { displayName: true } } } },
        apps: { orderBy: { sortOrder: 'asc' } },
        hardware: true,
        products: { where: { isActive: true }, orderBy: { category: 'asc' } },
      },
    });
    if (!club) throw new NotFoundException({ code: 'CLUB_NOT_FOUND' });
    const [openingNow, lockersFree] = await Promise.all([
      this.prisma.session.count({ where: { clubId: club.id, status: { in: ['ACTIVE', 'PAUSED'] } } }),
      this.prisma.locker.count({ where: { clubId: club.id, status: 'FREE' } }),
    ]);
    return { ...club, activeSessions: openingNow, lockersFree, currency: 'BYN' };
  }

  async guests(clubId: string, q?: string) {
    const users = await this.prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { sessions: { some: { clubId } } },
              { bookings: { some: { clubId } } },
              { clubRoles: { some: { clubId } } },
              { cashReceived: { some: { clubId } } },
            ],
          },
          q
            ? {
                OR: [
                  { phone: { contains: q } },
                  { displayName: { contains: q, mode: 'insensitive' } },
                  { guestCards: { some: { cardNumber: { contains: q } } } },
                ],
              }
            : {},
        ],
      },
      take: 100,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        phone: true,
        displayName: true,
        createdAt: true,
        wallet: { select: { balanceKopecks: true, bonusKopecks: true } },
        guestCards: { select: { cardNumber: true } },
        _count: { select: { sessions: { where: { clubId } }, bookings: { where: { clubId } } } },
      },
    });
    return users.map((u) => ({
      id: u.id,
      phone: u.phone.startsWith('walkin:') ? '' : u.phone,
      walkIn: u.phone.startsWith('walkin:'),
      displayName: u.displayName,
      createdAt: u.createdAt,
      balanceKopecks: u.wallet?.balanceKopecks ?? 0,
      bonusKopecks: u.wallet?.bonusKopecks ?? 0,
      cards: u.guestCards.map((c) => c.cardNumber),
      sessions: u._count.sessions,
      bookings: u._count.bookings,
    }));
  }

  hardware(clubId: string) {
    return this.prisma.hardwareProfile.findMany({ where: { clubId }, include: { _count: { select: { seats: true } } } });
  }

  createHardware(clubId: string, data: { name: string; cpu?: string; gpu?: string; ram?: string; monitor?: string }) {
    return this.prisma.hardwareProfile.create({ data: { clubId, ...data } });
  }

  async createClub(user: AuthUser, dto: CreateClubDto) {
    if (user.globalRole === UserRole.SUPPORT) throw new ForbiddenException({ code: 'FORBIDDEN' });
    let organizationId = dto.organizationId;
    if (!organizationId) {
      const existing = await this.prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
      organizationId =
        existing?.id ??
        (
          await this.prisma.organization.create({
            data: { name: dto.name },
          })
        ).id;
    }
    const club = await this.prisma.club.create({
      data: {
        organizationId,
        slug: dto.slug,
        name: dto.name,
        description: dto.description ?? '',
        city: dto.city,
        address: dto.address,
        lat: dto.lat ?? 0,
        lng: dto.lng ?? 0,
        amenities: dto.amenities ?? [],
      },
    });
    await this.prisma.userClubRole.create({
      data: { userId: user.id, clubId: club.id, role: UserRole.OWNER },
    });
    await this.prisma.staffProfile.create({
      data: { clubId: club.id, userId: user.id, login: user.phone, workPoint: dto.city, status: 'ACTIVE' },
    });
    return club;
  }

  updateClub(id: string, dto: UpdateClubDto) {
    return this.prisma.club.update({ where: { id }, data: dto });
  }

  createZone(clubId: string, dto: CreateZoneDto) {
    return this.prisma.zone.create({ data: { clubId, ...dto } });
  }

  createSeat(clubId: string, zoneId: string, dto: CreateSeatDto) {
    return this.prisma.seat.create({ data: { clubId, zoneId, ...dto } });
  }

  updateSeat(id: string, dto: UpdateSeatDto) {
    return this.prisma.seat.update({ where: { id }, data: dto });
  }

  createTariff(clubId: string, dto: CreateTariffDto) {
    return this.prisma.tariff.create({ data: { clubId, ...dto } });
  }

  async seatMap(clubId: string) {
    const seats = await this.prisma.seat.findMany({
      where: { clubId },
      include: {
        zone: true,
        sessions: {
          where: { status: { in: ['ACTIVE', 'PAUSED'] } },
          include: { user: { include: { wallet: true } } },
          take: 1,
        },
        telemetry: true,
        agent: true,
      },
    });
    return seats.map((s) => {
      const session = s.sessions[0];
      return {
        id: s.id,
        clubId: s.clubId,
        zoneId: s.zoneId,
        zoneName: s.zone.name,
        label: s.label,
        type: s.type,
        status: s.status,
        posX: s.posX,
        posY: s.posY,
        lastHeartbeatAt: s.agent?.lastSeenAt ?? s.telemetry?.lastHeartbeatAt ?? null,
        currentProcess: s.telemetry?.currentProcess ?? null,
        agentLastSeenAt: s.agent?.lastSeenAt ?? null,
        agentVersion: s.agent?.agentVersion || null,
        hostname: s.agent?.hostname || null,
        agentPaired: Boolean(s.agent?.tokenHash),
        guestName: session?.user.displayName ?? null,
        remainingSeconds: session?.remainingSeconds ?? null,
        balanceKopecks: session?.user.wallet?.balanceKopecks ?? null,
        sessionId: session?.id ?? null,
        sessionStatus: session?.status ?? null,
      };
    });
  }

  private isUuid(v: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  }
}
