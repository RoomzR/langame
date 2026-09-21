import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus, TransactionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { SocialService } from '../social/social.service';
import { GuestService } from '../club/guest.service';

@Injectable()
export class PaymentService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationService,
    private social: SocialService,
    private guests: GuestService,
  ) {}

  async mockTopup(userId: string, amountKopecks: number, description = 'bePaid / ЕРИП (песочница)') {
    const payment = await this.prisma.payment.create({
      data: {
        userId,
        amountKopecks,
        status: PaymentStatus.SUCCEEDED,
        provider: 'bepaid',
        providerRef: `bepaid_sandbox_${Date.now()}`,
        purpose: 'topup',
      },
    });
    return this.credit(payment.id, description);
  }

  async checkout(userId: string, amountKopecks: number, method: 'bepaid' | 'erip') {
    const providerRef =
      method === 'erip'
        ? `erip-${Math.floor(100000000 + Math.random() * 900000000)}`
        : `bepaid_${Date.now()}_${userId.slice(0, 8)}`;
    const payment = await this.prisma.payment.create({
      data: {
        userId,
        amountKopecks,
        status: PaymentStatus.PENDING,
        provider: method,
        providerRef,
        purpose: 'topup',
      },
    });
    return {
      paymentId: payment.id,
      status: payment.status,
      provider: method,
      amountKopecks,
      currency: 'BYN',
      amountLabel: `${(amountKopecks / 100).toFixed(2)} Br`,
      eripCode: method === 'erip' ? providerRef.replace('erip-', '') : null,
      checkoutUrl: `/api/v1/payments/${payment.id}/sandbox-complete`,
      instruction:
        method === 'erip'
          ? `Оплатите через ЕРИП, код услуги ${providerRef.replace('erip-', '')} (песочница RUDEMIR).`
          : 'Откройте bePaid checkout (песочница). Для теста вызовите sandbox-complete.',
    };
  }

  async sandboxComplete(paymentId: string, userId?: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND' });
    if (userId && payment.userId !== userId) throw new BadRequestException({ code: 'FORBIDDEN' });
    if (payment.status === PaymentStatus.SUCCEEDED) return this.wallet(payment.userId);
    return this.credit(payment.id, `${payment.provider} sandbox complete`);
  }

  async webhookBepaid(dto: { uid?: string; status?: string; amount?: number }) {
    const ref = dto.uid;
    if (!ref) throw new BadRequestException({ code: 'MISSING_UID' });
    const payment = await this.prisma.payment.findFirst({ where: { providerRef: ref } });
    if (!payment) throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND' });
    const ok = (dto.status ?? 'successful').toLowerCase();
    if (!['successful', 'success', 'paid'].includes(ok)) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED },
      });
      return { ok: false };
    }
    await this.credit(payment.id, 'bePaid webhook');
    return { ok: true };
  }

  get(id: string, userId: string) {
    return this.prisma.payment.findFirst({ where: { id, userId } });
  }

  async wallet(userId: string) {
    return this.ensureWallet(userId);
  }

  async history(userId: string) {
    const wallet = await this.ensureWallet(userId);
    return this.prisma.transaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  private async credit(paymentId: string, description: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND' });
    if (payment.status === PaymentStatus.SUCCEEDED) {
      return this.wallet(payment.userId);
    }
    const wallet = await this.ensureWallet(payment.userId);
    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.SUCCEEDED },
      }),
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: { balanceKopecks: { increment: payment.amountKopecks } },
      }),
      this.prisma.transaction.create({
        data: {
          walletId: wallet.id,
          amountKopecks: payment.amountKopecks,
          type: TransactionType.TOPUP,
          paymentId,
          description,
        },
      }),
    ]);
    await this.notifications.push(
      payment.userId,
      'payment.succeeded',
      'Баланс пополнен',
      `Зачислено ${(payment.amountKopecks / 100).toFixed(2)} Br`,
      { paymentId, amountKopecks: payment.amountKopecks },
    );
    await this.social.grant(payment.userId, 'first_topup').catch(() => undefined);
    return this.wallet(payment.userId);
  }

  async grantBonus(userId: string, amountKopecks: number, description?: string) {
    const wallet = await this.ensureWallet(userId);
    await this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: { bonusKopecks: { increment: amountKopecks } },
      }),
      this.prisma.transaction.create({
        data: {
          walletId: wallet.id,
          amountKopecks,
          type: TransactionType.BONUS,
          description: description ?? 'Бонус клуба',
        },
      }),
    ]);
    await this.notifications
      .push(
        userId,
        'bonus.granted',
        'Бонус',
        `Начислено ${(amountKopecks / 100).toFixed(2)} Br бонусами`,
        { amountKopecks },
      )
      .catch(() => undefined);
    return this.wallet(userId);
  }

  async redeemBonus(userId: string, amountKopecks?: number) {
    const wallet = await this.ensureWallet(userId);
    const amount = amountKopecks ?? wallet.bonusKopecks;
    if (amount <= 0) throw new BadRequestException({ code: 'NO_BONUS' });
    if (wallet.bonusKopecks < amount) throw new BadRequestException({ code: 'INSUFFICIENT_BONUS' });
    await this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          bonusKopecks: { decrement: amount },
          balanceKopecks: { increment: amount },
        },
      }),
      this.prisma.transaction.create({
        data: {
          walletId: wallet.id,
          amountKopecks: amount,
          type: TransactionType.BONUS,
          description: 'Перевод бонусов на баланс',
        },
      }),
    ]);
    return this.wallet(userId);
  }

  private async ensureWallet(userId: string) {
    const existing = await this.prisma.wallet.findUnique({ where: { userId } });
    if (existing) return existing;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    return this.prisma.wallet.create({ data: { userId, balanceKopecks: 0 } });
  }

  listCash(clubId: string, status?: string) {
    return this.prisma.cashOperation.findMany({
      where: { clubId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { id: true, displayName: true, phone: true } },
        createdBy: { select: { id: true, displayName: true } },
      },
    });
  }

  async drawerIn(
    clubId: string,
    actorId: string,
    dto: {
      amountKopecks: number;
      method: string;
      receiptNo?: string;
      guestName?: string;
      userId?: string;
      note?: string;
    },
  ) {
    return this.prisma.cashOperation.create({
      data: {
        clubId,
        createdById: actorId,
        userId: dto.userId,
        guestName: dto.guestName,
        amountKopecks: dto.amountKopecks,
        method: dto.method,
        status: 'DRAWER',
        receiptNo: dto.receiptNo ?? '',
        note: dto.note ?? '',
      },
    });
  }

  async postCash(
    clubId: string,
    actorId: string,
    opId: string,
    dto: { userId?: string; guestName?: string; guestPhone?: string },
  ) {
    const op = await this.prisma.cashOperation.findFirst({ where: { id: opId, clubId } });
    if (!op) throw new NotFoundException({ code: 'CASH_NOT_FOUND' });
    if (op.status === 'POSTED') return this.wallet(op.userId!);
    if (op.status === 'VOID') throw new BadRequestException({ code: 'CASH_VOID' });

    const guest = await this.guests.resolve(clubId, {
      userId: dto.userId || op.userId || undefined,
      name: dto.guestName || op.guestName || undefined,
      phone: dto.guestPhone || undefined,
    });

    const wallet = await this.ensureWallet(guest.id);
    const label = `Касса · ${op.method === 'CASH' ? 'наличные' : op.method === 'CARD' ? 'карта' : 'ЕРИП'}${op.receiptNo ? ` · чек ${op.receiptNo}` : ''}`;
    await this.prisma.$transaction([
      this.prisma.cashOperation.update({
        where: { id: op.id },
        data: { status: 'POSTED', postedAt: new Date(), userId: guest.id, guestName: guest.displayName },
      }),
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: { balanceKopecks: { increment: op.amountKopecks } },
      }),
      this.prisma.transaction.create({
        data: {
          walletId: wallet.id,
          amountKopecks: op.amountKopecks,
          type: TransactionType.TOPUP,
          description: label,
        },
      }),
      this.prisma.adminActionLog.create({
        data: {
          clubId,
          userId: actorId,
          action: 'CASH_POST',
          payload: { opId: op.id, amountKopecks: op.amountKopecks, guestId: guest.id },
        },
      }),
    ]);
    if (!guest.phone.startsWith('walkin:')) {
      await this.notifications
        .push(
          guest.id,
          'payment.succeeded',
          'Баланс пополнен',
          `Зачислено ${(op.amountKopecks / 100).toFixed(2)} Br с кассы`,
          { opId: op.id, amountKopecks: op.amountKopecks },
        )
        .catch(() => undefined);
    }
    return this.wallet(guest.id);
  }

  async voidCash(clubId: string, actorId: string, opId: string) {
    const op = await this.prisma.cashOperation.findFirst({ where: { id: opId, clubId } });
    if (!op) throw new NotFoundException({ code: 'CASH_NOT_FOUND' });
    if (op.status === 'POSTED') throw new BadRequestException({ code: 'CASH_ALREADY_POSTED' });
    await this.prisma.cashOperation.update({ where: { id: op.id }, data: { status: 'VOID' } });
    await this.prisma.adminActionLog.create({
      data: { clubId, userId: actorId, action: 'CASH_VOID', payload: { opId: op.id } },
    });
    return { ok: true };
  }

  async creditAfterRegister(
    clubId: string,
    actorId: string,
    userId: string,
    amountKopecks: number,
    description?: string,
  ) {
    const op = await this.drawerIn(clubId, actorId, {
      amountKopecks,
      method: 'CASH',
      userId,
      note: description ?? 'принято в кассе, зачисление с сайта',
    });
    return this.postCash(clubId, actorId, op.id, { userId });
  }
}
