import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { RealtimeService } from './realtime.service';
import { PrismaService } from '../../prisma/prisma.service';

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private realtime: RealtimeService,
    private jwt: JwtService,
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  async afterInit(server: Server) {
    this.realtime.attach(server);
    try {
      const url = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
      const pub = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
      const sub = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
      await pub.connect();
      await sub.connect();
      server.adapter(createAdapter(pub, sub) as any);
    } catch {
      // Redis adapter optional in tests / local without Redis
    }
  }

  async handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.token as string) ||
      (client.handshake.headers.authorization?.replace('Bearer ', '') as string | undefined);
    if (!token) {
      client.disconnect();
      return;
    }
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET') ?? 'dev-access',
      });
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { clubRoles: true },
      });
      if (!user) {
        client.disconnect();
        return;
      }
      client.data.userId = user.id;
      client.data.globalRole = user.globalRole;
      await client.join(`user:${user.id}`);
      for (const r of user.clubRoles) {
        await client.join(`club:${r.clubId}`);
      }
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage('join_club')
  async joinClub(@ConnectedSocket() client: Socket, @MessageBody() body: { clubId: string }) {
    if (body?.clubId) await client.join(`club:${body.clubId}`);
    return { ok: true };
  }

  @SubscribeMessage('join_seat')
  async joinSeat(@ConnectedSocket() client: Socket, @MessageBody() body: { seatId: string }) {
    if (body?.seatId) await client.join(`seat:${body.seatId}`);
    return { ok: true };
  }

  @SubscribeMessage('chat.send')
  async chat(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { clubId: string; seatId?: string; body: string },
  ) {
    if (!client.data.userId || !body?.body) return { ok: false };
    const msg = await this.prisma.chatMessage.create({
      data: {
        clubId: body.clubId,
        seatId: body.seatId,
        senderId: client.data.userId,
        body: body.body,
      },
    });
    this.realtime.emitBoth(body.clubId, body.seatId ?? '', 'chat.message', msg);
    return { ok: true, message: msg };
  }
}
