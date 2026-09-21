import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BillingMode, SeatStatus, SessionStatus, TransactionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationService } from '../notification/notification.service';
import { SocialService } from '../social/social.service';
import { StartSessionDto } from './dto';
import { WsEvent } from '../../common/events';
import { AgentService } from '../agent/agent.service';

@Injectable()
export class SessionService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeService,
    private notifications: NotificationService,
    private social: SocialService,
    private agents: AgentService,
  ) {}

  async start(clubId: string, dto: StartSessionDto) {
    const seat = await this.prisma.seat.findFirst({ where: { id: dto.seatId, clubId } });
    if (!seat) throw new NotFoundException({ code: 'SEAT_NOT_FOUND' });
    if (seat.status === SeatStatus.MAINTENANCE || seat.status === SeatStatus.OFFLINE) {
      throw new BadRequestException({ code: 'SEAT_UNAVAILABLE' });
    }

    const active = await this.prisma.session.findFirst({
      where: { seatId: dto.seatId, status: { in: [SessionStatus.ACTIVE, SessionStatus.PAUSED] } },
    });
    if (active) throw new BadRequestException({ code: 'SEAT_BUSY' });

    const tariff = await this.prisma.tariff.findFirst({ where: { id: dto.tariffId, clubId } });
    if (!tariff) throw new NotFoundException({ code: 'TARIFF_NOT_FOUND' });

    const wallet = await this.prisma.wallet.findUnique({ where: { userId: dto.userId } });
    if (!wallet) throw new BadRequestException({ code: 'WALLET_NOT_FOUND' });

    const billingMode = dto.billingMode ?? BillingMode.WALLET;
    let remainingSeconds: number | null = null;
    if (billingMode === BillingMode.PREPAID) {
      const minutes = dto.prepaidMinutes ?? tariff.minMinutes;
      remainingSeconds = minutes * 60;
      const cost = Math.round((tariff.pricePerHourKopecks * minutes) / 60);
      if (wallet.balanceKopecks < cost) throw new BadRequestException({ code: 'INSUFFICIENT_FUNDS' });
      await this.prisma.wallet.update({
        where: { id: wallet.id },
        data: { balanceKopecks: { decrement: cost } },
      });
    } else if (wallet.balanceKopecks <= 0) {
      throw new BadRequestException({ code: 'INSUFFICIENT_FUNDS' });
    }

    const session = await this.prisma.session.create({
      data: {
        clubId,
        seatId: dto.seatId,
        userId: dto.userId,
        tariffId: dto.tariffId,
        bookingId: dto.bookingId,
        billingMode,
        remainingSeconds,
        lastTickAt: new Date(),
        status: SessionStatus.ACTIVE,
        totalChargedKopecks:
          billingMode === BillingMode.PREPAID
            ? Math.round((tariff.pricePerHourKopecks * (dto.prepaidMinutes ?? tariff.minMinutes)) / 60)
            : 0,
      },
      include: { user: true, seat: true, tariff: true },
    });

    if (billingMode === BillingMode.PREPAID) {
      await this.prisma.transaction.create({
        data: {
          walletId: wallet.id,
          amountKopecks: -session.totalChargedKopecks,
          type: TransactionType.SESSION_CHARGE,
          sessionId: session.id,
          description: 'Prepaid session start',
        },
      });
    }

    await this.prisma.seat.update({
      where: { id: seat.id },
      data: { status: SeatStatus.OCCUPIED },
    });

    this.emitSession(session);
    await this.agents.dispatchPc(clubId, seat.id, 'UNLOCK').catch(() => undefined);
    return session;
  }

  async pause(sessionId: string) {
    const session = await this.requireActive(sessionId);
    const updated = await this.prisma.session.update({
      where: { id: sessionId },
      data: { status: SessionStatus.PAUSED, pausedAt: new Date() },
      include: { user: true, seat: true, tariff: true },
    });
    this.emitSession(updated);
    return updated;
  }

  async resume(sessionId: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.status !== SessionStatus.PAUSED) {
      throw new BadRequestException({ code: 'NOT_PAUSED' });
    }
    const updated = await this.prisma.session.update({
      where: { id: sessionId },
      data: { status: SessionStatus.ACTIVE, pausedAt: null, lastTickAt: new Date() },
      include: { user: true, seat: true, tariff: true },
    });
    this.emitSession(updated);
    return updated;
  }

  async stop(sessionId: string, reason = 'MANUAL') {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.status === SessionStatus.ENDED) {
      throw new BadRequestException({ code: 'ALREADY_ENDED' });
    }
    return this.finish(session.id, reason);
  }

  async extend(sessionId: string, minutes: number) {
    const session = await this.requireActive(sessionId);
    const tariff = await this.prisma.tariff.findUnique({ where: { id: session.tariffId } });
    if (!tariff) throw new NotFoundException();
    const cost = Math.round((tariff.pricePerHourKopecks * minutes) / 60);
    const wallet = await this.prisma.wallet.findUnique({ where: { userId: session.userId } });
    if (!wallet || wallet.balanceKopecks < cost) {
      throw new BadRequestException({ code: 'INSUFFICIENT_FUNDS' });
    }
    await this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: { balanceKopecks: { decrement: cost } },
      }),
      this.prisma.transaction.create({
        data: {
          walletId: wallet.id,
          amountKopecks: -cost,
          type: TransactionType.SESSION_CHARGE,
          sessionId,
          description: `Extend ${minutes} min`,
        },
      }),
      this.prisma.session.update({
        where: { id: sessionId },
        data: {
          billingMode: BillingMode.PREPAID,
          remainingSeconds: (session.remainingSeconds ?? 0) + minutes * 60,
          totalChargedKopecks: { increment: cost },
        },
      }),
    ]);
    const updated = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true, seat: true, tariff: true },
    });
    this.emitSession(updated);
    return updated;
  }

  async transfer(sessionId: string, toSeatId: string) {
    const session = await this.requireActive(sessionId);
    const dest = await this.prisma.seat.findFirst({
      where: { id: toSeatId, clubId: session.clubId },
    });
    if (!dest) throw new NotFoundException({ code: 'SEAT_NOT_FOUND' });
    const busy = await this.prisma.session.findFirst({
      where: { seatId: toSeatId, status: { in: [SessionStatus.ACTIVE, SessionStatus.PAUSED] } },
    });
    if (busy) throw new BadRequestException({ code: 'SEAT_BUSY' });

    await this.prisma.$transaction([
      this.prisma.seat.update({
        where: { id: session.seatId },
        data: { status: SeatStatus.FREE },
      }),
      this.prisma.seat.update({
        where: { id: dest.id },
        data: { status: SeatStatus.OCCUPIED },
      }),
      this.prisma.session.update({
        where: { id: sessionId },
        data: { seatId: dest.id },
      }),
    ]);
    const updated = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true, seat: true, tariff: true },
    });
    this.realtime.emitToClub(session.clubId, WsEvent.SeatUpdated, {
      from: session.seatId,
      to: dest.id,
    });
    this.emitSession(updated);
    return updated;
  }

  async tickOnce() {
    const sessions = await this.prisma.session.findMany({
      where: { status: SessionStatus.ACTIVE },
      include: { tariff: true },
    });
    const now = new Date();
    for (const session of sessions) {
      const last = session.lastTickAt ?? session.startedAt;
      const deltaSec = Math.max(0, Math.floor((now.getTime() - last.getTime()) / 1000));
      if (deltaSec < 1) continue;

      if (session.billingMode === BillingMode.PREPAID) {
        const remaining = (session.remainingSeconds ?? 0) - deltaSec;
        if (remaining <= 0) {
          await this.finish(session.id, 'TIME_EXPIRED');
          continue;
        }
        await this.prisma.session.update({
          where: { id: session.id },
          data: {
            remainingSeconds: remaining,
            lastTickAt: now,
            accumulatedActiveSeconds: { increment: deltaSec },
          },
        });
      } else {
        const charge = Math.max(1, Math.round((session.tariff.pricePerHourKopecks * deltaSec) / 3600));
        const wallet = await this.prisma.wallet.findUnique({ where: { userId: session.userId } });
        if (!wallet || wallet.balanceKopecks < charge) {
          if (wallet && wallet.balanceKopecks > 0) {
            await this.debit(session.id, wallet.id, wallet.balanceKopecks, deltaSec);
          }
          await this.finish(session.id, 'BALANCE_EXPIRED');
          continue;
        }
        await this.debit(session.id, wallet.id, charge, deltaSec, now);
      }

      const fresh = await this.prisma.session.findUnique({
        where: { id: session.id },
        include: { user: true, seat: true, tariff: true },
      });
      if (fresh && fresh.status !== SessionStatus.ENDED) this.emitSession(fresh);
    }
  }

  async heartbeat(seatId: string, currentProcess?: string) {
    await this.prisma.seatTelemetry.upsert({
      where: { seatId },
      update: { currentProcess, lastHeartbeatAt: new Date() },
      create: { seatId, currentProcess, lastHeartbeatAt: new Date() },
    });
    const seat = await this.prisma.seat.findUnique({ where: { id: seatId } });
    if (seat) {
      this.realtime.emitToClub(seat.clubId, WsEvent.SeatUpdated, {
        seatId,
        currentProcess,
        lastHeartbeatAt: new Date().toISOString(),
      });
    }
    return { ok: true };
  }

  async callAdmin(clubId: string, seatId: string, userId: string, message?: string) {
    const call = await this.prisma.adminCall.create({
      data: { clubId, seatId, userId, message: message ?? '' },
    });
    this.realtime.emitToClub(clubId, WsEvent.AdminCall, call);
    return call;
  }

  async sendChat(clubId: string, userId: string, body: string, seatId?: string) {
    if (!body?.trim()) throw new BadRequestException({ code: 'EMPTY_MESSAGE' });
    const msg = await this.prisma.chatMessage.create({
      data: { clubId, seatId, senderId: userId, body: body.trim() },
      include: { sender: { select: { id: true, displayName: true } }, seat: { select: { label: true } } },
    });
    this.realtime.emitBoth(clubId, seatId ?? '', WsEvent.ChatMessage, msg);
    return msg;
  }

  async pcCommand(clubId: string, seatId: string, command: string) {
    return this.agents.dispatchPc(clubId, seatId, command);
  }

  private async debit(
    sessionId: string,
    walletId: string,
    amount: number,
    deltaSec: number,
    now = new Date(),
  ) {
    await this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: walletId },
        data: { balanceKopecks: { decrement: amount } },
      }),
      this.prisma.transaction.create({
        data: {
          walletId,
          amountKopecks: -amount,
          type: TransactionType.SESSION_CHARGE,
          sessionId,
          description: `Tick ${deltaSec}s`,
        },
      }),
      this.prisma.session.update({
        where: { id: sessionId },
        data: {
          lastTickAt: now,
          accumulatedActiveSeconds: { increment: deltaSec },
          totalChargedKopecks: { increment: amount },
        },
      }),
    ]);
  }

  private async finish(sessionId: string, reason: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException();
    const updated = await this.prisma.session.update({
      where: { id: sessionId },
      data: { status: SessionStatus.ENDED, endedAt: new Date(), endReason: reason },
      include: { user: true, seat: true, tariff: true },
    });
    await this.prisma.seat.update({
      where: { id: session.seatId },
      data: { status: SeatStatus.FREE },
    });
    this.emitSession(updated);
    this.realtime.emitBoth(session.clubId, session.seatId, WsEvent.SeatUpdated, {
      seatId: session.seatId,
      status: SeatStatus.FREE,
    });
    this.realtime.emitToSeat(session.seatId, WsEvent.PcCommand, {
      seatId: session.seatId,
      command: 'LOCK',
    });
    await this.agents.enqueue(session.clubId, 'LOCK', session.seatId).catch(() => undefined);
    await this.notifications
      .push(
        session.userId,
        'session.ended',
        'Сессия завершена',
        reason === 'BALANCE_EXPIRED'
          ? 'Закончился баланс. Пополните счёт в bePaid / ЕРИП.'
          : 'Игровое время окончено.',
        { sessionId, reason },
      )
      .catch(() => undefined);
    await this.social.grantSessionAchievements(session.userId).catch(() => undefined);
    return updated;
  }

  listMine(userId: string) {
    return this.prisma.session.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: 50,
      include: { club: { select: { name: true, slug: true } }, seat: { select: { label: true } } },
    });
  }

  listCalls(clubId: string, openOnly = true) {
    return this.prisma.adminCall.findMany({
      where: { clubId, ...(openOnly ? { resolved: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        seat: { select: { label: true } },
        user: { select: { id: true, displayName: true, phone: true } },
      },
    });
  }

  async resolveCall(clubId: string, callId: string) {
    const call = await this.prisma.adminCall.findFirst({ where: { id: callId, clubId } });
    if (!call) throw new NotFoundException({ code: 'CALL_NOT_FOUND' });
    const updated = await this.prisma.adminCall.update({
      where: { id: callId },
      data: { resolved: true },
    });
    this.realtime.emitToClub(clubId, WsEvent.AdminCall, { ...updated, resolved: true });
    return updated;
  }

  chatHistory(clubId: string, seatId?: string) {
    return this.prisma.chatMessage.findMany({
      where: { clubId, ...(seatId ? { seatId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 80,
      include: { sender: { select: { id: true, displayName: true } }, seat: { select: { label: true } } },
    });
  }

  private async requireActive(sessionId: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.status === SessionStatus.ENDED) {
      throw new BadRequestException({ code: 'SESSION_INACTIVE' });
    }
    return session;
  }

  private emitSession(session: any) {
    if (!session) return;
    this.realtime.emitBoth(session.clubId, session.seatId, WsEvent.SessionUpdated, {
      id: session.id,
      clubId: session.clubId,
      seatId: session.seatId,
      userId: session.userId,
      status: session.status,
      billingMode: session.billingMode,
      remainingSeconds: session.remainingSeconds,
      totalChargedKopecks: session.totalChargedKopecks,
      startedAt: session.startedAt,
      lastTickAt: session.lastTickAt,
      guestName: session.user?.displayName,
      seatLabel: session.seat?.label,
    });
  }
}
