import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { BookingStatus, SeatStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { SessionService } from '../session/session.service';
import { NotificationService } from '../notification/notification.service';
import { GuestService } from '../club/guest.service';
import { CreateBookingDto } from './dto';
import { WsEvent } from '../../common/events';

@Injectable()
export class BookingService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeService,
    @Inject(forwardRef(() => SessionService))
    private sessions: SessionService,
    private notifications: NotificationService,
    private guests: GuestService,
  ) {}

  async availability(seatId: string, from: Date, to: Date) {
    const bookings = await this.prisma.booking.findMany({
      where: {
        seatId,
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        startsAt: { lt: to },
        endsAt: { gt: from },
      },
      select: { id: true, startsAt: true, endsAt: true, status: true },
    });
    const sessions = await this.prisma.session.findMany({
      where: {
        seatId,
        status: { in: ['ACTIVE', 'PAUSED'] },
      },
      select: { id: true, startedAt: true },
    });
    return { bookings, sessions };
  }

  async clubAvailability(clubId: string, from: Date, to: Date) {
    const [seats, bookings, sessions] = await Promise.all([
      this.prisma.seat.findMany({
        where: { clubId },
        select: { id: true, label: true, status: true, zoneId: true, posX: true, posY: true, type: true },
      }),
      this.prisma.booking.findMany({
        where: {
          clubId,
          status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
          startsAt: { lt: to },
          endsAt: { gt: from },
        },
        select: { seatId: true },
      }),
      from.getTime() <= Date.now() + 15 * 60_000
        ? this.prisma.session.findMany({
            where: { clubId, status: { in: ['ACTIVE', 'PAUSED'] } },
            select: { seatId: true },
          })
        : Promise.resolve([] as { seatId: string }[]),
    ]);
    const busy = new Set([...bookings.map((b) => b.seatId), ...sessions.map((s) => s.seatId)]);
    return seats.map((s) => ({
      ...s,
      available: !busy.has(s.id) && s.status !== 'MAINTENANCE' && s.status !== 'OFFLINE',
    }));
  }

  async create(clubId: string, actorId: string, dto: CreateBookingDto) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) throw new BadRequestException({ code: 'INVALID_RANGE' });

    const seat = await this.prisma.seat.findFirst({ where: { id: dto.seatId, clubId } });
    if (!seat) throw new NotFoundException({ code: 'SEAT_NOT_FOUND' });

    let userId = dto.userId;
    let guestName = dto.guestName?.trim() || null;
    let guestPhone = dto.guestPhone?.replace(/\s+/g, '') || null;
    if (!userId && (guestName || guestPhone)) {
      const guest = await this.guests.resolve(clubId, { name: guestName ?? undefined, phone: guestPhone ?? undefined });
      userId = guest.id;
      guestName = guest.displayName;
      guestPhone = this.guests.displayPhone(guest.phone) || guestPhone;
    }
    if (!userId) userId = actorId;

    const overlap = await this.prisma.booking.findFirst({
      where: {
        seatId: dto.seatId,
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });
    if (overlap) throw new BadRequestException({ code: 'SLOT_TAKEN' });

    try {
      const booking = await this.prisma.booking.create({
        data: {
          clubId,
          seatId: dto.seatId,
          userId,
          tariffId: dto.tariffId,
          startsAt,
          endsAt,
          autoStartSession: dto.autoStartSession ?? true,
          status: BookingStatus.CONFIRMED,
          guestName,
          guestPhone,
        },
      });
      if (startsAt <= new Date() && endsAt > new Date()) {
        await this.prisma.seat.update({
          where: { id: seat.id },
          data: { status: SeatStatus.RESERVED },
        });
      }
      this.realtime.emitBoth(clubId, dto.seatId, WsEvent.BookingUpdated, booking);
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
      if (user && !user.phone.startsWith('walkin:')) {
        await this.notifications
          .push(
            userId,
            'booking.confirmed',
            'Бронь подтверждена',
            'Место забронировано. Сессия стартует автоматически к началу слота.',
            { bookingId: booking.id, clubId, seatId: dto.seatId },
          )
          .catch(() => undefined);
      }
      return booking;
    } catch (e: any) {
      if (e?.code === '23P01' || String(e?.message ?? '').includes('bookings_seat_period_excl')) {
        throw new BadRequestException({ code: 'SLOT_TAKEN' });
      }
      throw e;
    }
  }

  async arrive(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException({ code: 'BOOKING_NOT_FOUND' });
    if (booking.status !== BookingStatus.CONFIRMED && booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException({ code: 'BOOKING_NOT_ACTIVE' });
    }
    const session = await this.sessions.start(booking.clubId, {
      seatId: booking.seatId,
      userId: booking.userId,
      tariffId: booking.tariffId,
      bookingId: booking.id,
      billingMode: 'WALLET',
    });
    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.COMPLETED },
    });
    this.realtime.emitBoth(booking.clubId, booking.seatId, WsEvent.BookingUpdated, updated);
    return { booking: updated, session };
  }

  async cancel(bookingId: string, actorId?: string, isStaff = false) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException();
    if (!isStaff && actorId && booking.userId !== actorId) {
      throw new BadRequestException({ code: 'FORBIDDEN' });
    }
    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CANCELLED },
    });
    this.realtime.emitBoth(booking.clubId, booking.seatId, WsEvent.BookingUpdated, updated);
    return updated;
  }

  async reschedule(bookingId: string, startsAt: Date, endsAt: Date) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException();
    const overlap = await this.prisma.booking.findFirst({
      where: {
        seatId: booking.seatId,
        id: { not: bookingId },
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });
    if (overlap) throw new BadRequestException({ code: 'SLOT_TAKEN' });
    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { startsAt, endsAt },
    });
    this.realtime.emitBoth(booking.clubId, booking.seatId, WsEvent.BookingUpdated, updated);
    return updated;
  }

  async isStaffFor(bookingId: string, user: { id: string; globalRole: string }) {
    if (user.globalRole === 'SUPERADMIN' || user.globalRole === 'SUPPORT') return true;
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return false;
    const role = await this.prisma.userClubRole.findUnique({
      where: { userId_clubId: { userId: user.id, clubId: booking.clubId } },
    });
    return !!role && role.role !== 'GUEST';
  }

  async listMine(userId: string) {
    return this.prisma.booking.findMany({
      where: { userId },
      orderBy: { startsAt: 'desc' },
      include: { club: true, seat: true, tariff: true },
    });
  }

  async listClub(clubId: string, all = false) {
    return this.prisma.booking.findMany({
      where: all
        ? { clubId, startsAt: { gte: new Date(Date.now() - 7 * 86400_000) } }
        : { clubId, status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] } },
      orderBy: { startsAt: all ? 'desc' : 'asc' },
      take: 200,
      include: {
        user: { select: { id: true, displayName: true, phone: true } },
        seat: { select: { id: true, label: true } },
        tariff: { select: { name: true, pricePerHourKopecks: true } },
      },
    });
  }

  async tickBookings() {
    const now = new Date();
    const due = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.CONFIRMED,
        autoStartSession: true,
        startsAt: { lte: now },
        endsAt: { gt: now },
        sessions: { none: { status: { in: ['ACTIVE', 'PAUSED'] } } },
      },
    });
    for (const b of due) {
      try {
        await this.sessions.start(b.clubId, {
          seatId: b.seatId,
          userId: b.userId,
          tariffId: b.tariffId,
          bookingId: b.id,
          billingMode: 'WALLET',
        });
      } catch {
        // seat busy or no funds — leave booking confirmed
      }
    }

    await this.prisma.booking.updateMany({
      where: { status: BookingStatus.CONFIRMED, endsAt: { lt: now }, sessions: { none: {} } },
      data: { status: BookingStatus.NO_SHOW },
    });
  }
}
