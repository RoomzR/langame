import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { WsEvent } from '../../common/events';

@Injectable()
export class NotificationService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeService,
  ) {}

  async push(
    userId: string,
    type: string,
    title: string,
    body: string,
    payload: Prisma.InputJsonValue = {},
  ) {
    const row = await this.prisma.notification.create({
      data: { userId, type, title, body, payload },
    });
    this.realtime.emitToUser(userId, WsEvent.Notification, row);
    return row;
  }

  list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(userId: string, id?: string) {
    await this.prisma.notification.updateMany({
      where: id ? { id, userId } : { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}
