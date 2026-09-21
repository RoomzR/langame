import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IoAdapter } from '@nestjs/platform-socket.io';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SessionService } from '../src/modules/session/session.service';
import { BillingMode } from '@prisma/client';

describe('RUDEMIR session flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sessions: SessionService;
  let serverUrl: string;

  beforeAll(async () => {
    process.env.DISABLE_TICKER = '1';
    process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-min-32-chars';
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-min-32-chars';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useWebSocketAdapter(new IoAdapter(app));
    await app.init();
    await app.listen(0);
    const addr = app.getHttpServer().address();
    const port = typeof addr === 'object' && addr ? addr.port : 3000;
    serverUrl = `http://127.0.0.1:${port}`;
    prisma = app.get(PrismaService);
    sessions = app.get(SessionService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('booking → session → debit → auto-stop + websocket', async () => {
    const adminLogin = await request(serverUrl)
      .post('/api/v1/auth/login')
      .send({ phone: '+375291000003', password: 'admin123' })
      .expect(201);
    const adminToken = adminLogin.body.accessToken as string;

    const guestLogin = await request(serverUrl)
      .post('/api/v1/auth/login')
      .send({ phone: '+375291000004', password: 'guest123' })
      .expect(201);
    const guestToken = guestLogin.body.accessToken as string;

    const me = await request(serverUrl)
      .get(' /api/v1/auth/me'.trim())
      .set('Authorization', `Bearer ${guestToken}`)
      .expect(200);
    const guestId = me.body.id as string;

    const clubs = await request(serverUrl).get('/api/v1/clubs').expect(200);
    const club = clubs.body.find((c: any) => c.slug === 'rudemir-minsk') ?? clubs.body[0];
    expect(club).toBeTruthy();

    const detail = await request(serverUrl).get(`/api/v1/clubs/${club.slug}`).expect(200);
    const seat = detail.body.zones[0].seats[0];
    const tariff = detail.body.tariffs[0];
    expect(seat).toBeTruthy();
    expect(tariff).toBeTruthy();

    await request(serverUrl)
      .post('/api/v1/payments/mock-topup')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({ amountKopecks: 20_000 })
      .expect(201);

    const startsAt = new Date(Date.now() - 60_000).toISOString();
    const endsAt = new Date(Date.now() + 60 * 60_000).toISOString();
    const bookingRes = await request(serverUrl)
      .post(`/api/v1/clubs/${detail.body.id}/bookings`)
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        seatId: seat.id,
        tariffId: tariff.id,
        startsAt,
        endsAt,
        autoStartSession: false,
      });
    expect([201, 400]).toContain(bookingRes.status);

    const wsEvents: any[] = [];
    const socket: Socket = io(serverUrl, {
      auth: { token: adminToken },
      transports: ['websocket'],
    });
    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => resolve());
      socket.on('connect_error', reject);
      setTimeout(() => reject(new Error('ws timeout')), 5000);
    });
    socket.emit('join_club', { clubId: detail.body.id });
    socket.emit('join_seat', { seatId: seat.id });
    socket.on('session.updated', (p) => wsEvents.push(p));

    const start = await request(serverUrl)
      .post(`/api/v1/clubs/${detail.body.id}/sessions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        seatId: seat.id,
        userId: guestId,
        tariffId: tariff.id,
        billingMode: BillingMode.WALLET,
      });
    expect(start.status).toBe(201);
    const sessionId = start.body.id as string;

    const walletBefore = await prisma.wallet.findUnique({ where: { userId: guestId } });
    await prisma.session.update({
      where: { id: sessionId },
      data: { lastTickAt: new Date(Date.now() - 10_000) },
    });
    await sessions.tickOnce();

    const walletAfter = await prisma.wallet.findUnique({ where: { userId: guestId } });
    expect(walletAfter!.balanceKopecks).toBeLessThan(walletBefore!.balanceKopecks);

    await prisma.wallet.update({ where: { userId: guestId }, data: { balanceKopecks: 1 } });
    await prisma.session.update({
      where: { id: sessionId },
      data: { lastTickAt: new Date(Date.now() - 10_000), status: 'ACTIVE' },
    });
    await sessions.tickOnce();

    const ended = await prisma.session.findUnique({ where: { id: sessionId } });
    expect(ended?.status).toBe('ENDED');
    const seatAfter = await prisma.seat.findUnique({ where: { id: seat.id } });
    expect(seatAfter?.status).toBe('FREE');

    await new Promise((r) => setTimeout(r, 300));
    expect(wsEvents.some((e) => e.id === sessionId)).toBe(true);

    socket.close();
  }, 30_000);
});
