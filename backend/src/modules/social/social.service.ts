import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FriendshipStatus, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class SocialService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationService,
  ) {}

  async publicProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        locale: true,
        createdAt: true,
        achievements: { include: { achievement: true } },
      },
    });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    return {
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      locale: user.locale,
      memberSince: user.createdAt,
      achievements: user.achievements.map((a) => a.achievement),
    };
  }

  catalog() {
    return this.prisma.achievement.findMany({ orderBy: { name: 'asc' } });
  }

  async mine(userId: string) {
    const rows = await this.prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
      orderBy: { id: 'desc' },
    });
    return rows.map((r) => r.achievement);
  }

  async grant(userId: string, code: string) {
    const achievement = await this.prisma.achievement.findUnique({ where: { code } });
    if (!achievement) return null;
    try {
      await this.prisma.userAchievement.create({
        data: { userId, achievementId: achievement.id },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return achievement;
      throw e;
    }
    await this.notifications
      .push(userId, 'achievement.unlocked', 'Достижение', achievement.name, { code })
      .catch(() => undefined);
    return achievement;
  }

  async grantSessionAchievements(userId: string) {
    await this.grant(userId, 'first_session');
    const ended = await this.prisma.session.count({
      where: { userId, status: 'ENDED' },
    });
    if (ended >= 5) await this.grant(userId, 'regular_5');
  }

  async friends(userId: string) {
    const rows = await this.prisma.friendship.findMany({
      where: {
        OR: [{ userId }, { friendId: userId }],
        status: { in: [FriendshipStatus.PENDING, FriendshipStatus.ACCEPTED, FriendshipStatus.BLOCKED] },
      },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
        friend: { select: { id: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { id: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      incoming: r.friendId === userId,
      peer: r.userId === userId ? r.friend : r.user,
    }));
  }

  async request(userId: string, peerId: string) {
    if (userId === peerId) throw new BadRequestException({ code: 'SELF_FRIEND' });
    const peer = await this.prisma.user.findUnique({ where: { id: peerId } });
    if (!peer) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { userId, friendId: peerId },
          { userId: peerId, friendId: userId },
        ],
      },
    });
    if (existing) {
      if (existing.status === FriendshipStatus.BLOCKED) {
        throw new BadRequestException({ code: 'BLOCKED' });
      }
      return existing;
    }
    const row = await this.prisma.friendship.create({
      data: { userId, friendId: peerId, status: FriendshipStatus.PENDING },
    });
    await this.notifications
      .push(peerId, 'friend.request', 'Заявка в друзья', 'Вам отправили заявку в друзья RUDEMIR', {
        fromUserId: userId,
        friendshipId: row.id,
      })
      .catch(() => undefined);
    return row;
  }

  async accept(userId: string, friendshipId: string) {
    const row = await this.prisma.friendship.findUnique({ where: { id: friendshipId } });
    if (!row || row.friendId !== userId) throw new NotFoundException({ code: 'FRIEND_REQUEST_NOT_FOUND' });
    if (row.status !== FriendshipStatus.PENDING) throw new BadRequestException({ code: 'NOT_PENDING' });
    const updated = await this.prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: FriendshipStatus.ACCEPTED },
    });
    await this.notifications
      .push(row.userId, 'friend.accepted', 'Друзья', 'Заявка в друзья принята', { friendshipId })
      .catch(() => undefined);
    return updated;
  }

  async decline(userId: string, friendshipId: string) {
    const row = await this.prisma.friendship.findUnique({ where: { id: friendshipId } });
    if (!row || (row.userId !== userId && row.friendId !== userId)) {
      throw new NotFoundException({ code: 'FRIEND_REQUEST_NOT_FOUND' });
    }
    await this.prisma.friendship.delete({ where: { id: friendshipId } });
    return { ok: true };
  }

  async block(userId: string, friendshipId: string) {
    const row = await this.prisma.friendship.findUnique({ where: { id: friendshipId } });
    if (!row || (row.userId !== userId && row.friendId !== userId)) {
      throw new NotFoundException({ code: 'FRIEND_REQUEST_NOT_FOUND' });
    }
    return this.prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: FriendshipStatus.BLOCKED },
    });
  }

  listCards(clubId: string) {
    return this.prisma.guestCard.findMany({
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            phone: true,
            wallet: true,
            clubRoles: { where: { clubId }, select: { role: true } },
          },
        },
      },
      take: 200,
      orderBy: { cardNumber: 'asc' },
    });
  }

  async getCard(clubId: string, cardNumber: string) {
    const card = await this.prisma.guestCard.findUnique({
      where: { cardNumber },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            phone: true,
            wallet: true,
            clubRoles: { where: { clubId } },
          },
        },
      },
    });
    if (!card) throw new NotFoundException({ code: 'CARD_NOT_FOUND' });
    return {
      cardNumber: card.cardNumber,
      userId: card.user.id,
      displayName: card.user.displayName,
      phone: card.user.phone,
      wallet: card.user.wallet,
    };
  }

  async issueCard(userId: string, cardNumber: string, pin: string) {
    if (!/^\d{4,16}$/.test(cardNumber)) throw new BadRequestException({ code: 'INVALID_CARD_NUMBER' });
    if (!/^\d{4,8}$/.test(pin)) throw new BadRequestException({ code: 'INVALID_PIN' });
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    const exists = await this.prisma.guestCard.findUnique({ where: { cardNumber } });
    if (exists) throw new BadRequestException({ code: 'CARD_TAKEN' });
    return this.prisma.guestCard.create({
      data: {
        userId,
        cardNumber,
        pinHash: await bcrypt.hash(pin, 10),
      },
    });
  }

  async changePin(userId: string, cardNumber: string, oldPin: string, newPin: string) {
    if (!/^\d{4,8}$/.test(newPin)) throw new BadRequestException({ code: 'INVALID_PIN' });
    const card = await this.prisma.guestCard.findFirst({ where: { cardNumber, userId } });
    if (!card || !(await bcrypt.compare(oldPin, card.pinHash))) {
      throw new BadRequestException({ code: 'INVALID_CARD' });
    }
    await this.prisma.guestCard.update({
      where: { id: card.id },
      data: { pinHash: await bcrypt.hash(newPin, 10) },
    });
    return { ok: true };
  }
}
