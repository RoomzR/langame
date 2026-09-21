import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

async function login(server: string, phone: string, password: string) {
  const res = await request(server).post('/api/v1/auth/login').send({ phone, password }).expect(201);
  return res.body.accessToken as string;
}

describe('RUDEMIR floor ops (e2e)', () => {
  let app: INestApplication;
  let serverUrl: string;

  beforeAll(async () => {
    process.env.DISABLE_TICKER = '1';
    process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-min-32-chars';
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-min-32-chars';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    await app.listen(0);
    const addr = app.getHttpServer().address();
    const port = typeof addr === 'object' && addr ? addr.port : 3000;
    serverUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('club card exposes hardware, products and availability', async () => {
    const clubs = await request(serverUrl).get('/api/v1/clubs').expect(200);
    const club = clubs.body.find((c: any) => c.slug === 'rudemir-minsk') ?? clubs.body[0];
    const detail = await request(serverUrl).get(`/api/v1/clubs/${club.slug}`).expect(200);
    expect(Array.isArray(detail.body.hardware)).toBe(true);
    expect(Array.isArray(detail.body.products)).toBe(true);
    expect(detail.body.currency).toBe('BYN');

    const from = new Date(Date.now() + 3 * 86400_000);
    const to = new Date(from.getTime() + 3600_000);
    const avail = await request(serverUrl)
      .get(`/api/v1/clubs/${club.id}/availability?from=${from.toISOString()}&to=${to.toISOString()}`)
      .expect(200);
    expect(avail.body.length).toBe(detail.body.zones.flatMap((z: any) => z.seats).length);
    expect(avail.body.every((s: any) => typeof s.available === 'boolean')).toBe(true);
  });

  it('admin: guests search, booking arrive → session, cash orders', async () => {
    const admin = await login(serverUrl, '+375291000003', 'admin123');
    const guest = await login(serverUrl, '+375291000004', 'guest123');
    const clubs = await request(serverUrl).get('/api/v1/clubs').expect(200);
    const club = clubs.body.find((c: any) => c.slug === 'rudemir-minsk') ?? clubs.body[0];
    const detail = await request(serverUrl).get(`/api/v1/clubs/${club.slug}`).expect(200);
    const seat = detail.body.zones[0].seats[1];
    const tariff = detail.body.tariffs[0];

    const guests = await request(serverUrl)
      .get(`/api/v1/clubs/${club.id}/guests?q=1000004`)
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);
    const g = guests.body.find((x: any) => x.phone === '+375291000004');
    expect(g).toBeTruthy();

    await request(serverUrl)
      .post('/api/v1/payments/mock-topup')
      .set('Authorization', `Bearer ${guest}`)
      .send({ amountKopecks: 5000 })
      .expect(201);

    const startsAt = new Date(Date.now() + 5 * 86400_000);
    const booking = await request(serverUrl)
      .post(`/api/v1/clubs/${club.id}/bookings`)
      .set('Authorization', `Bearer ${admin}`)
      .send({
        userId: g.id,
        seatId: seat.id,
        tariffId: tariff.id,
        startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + 3600_000).toISOString(),
      })
      .expect(201);

    const list = await request(serverUrl)
      .get(`/api/v1/clubs/${club.id}/bookings`)
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);
    expect(list.body.some((b: any) => b.id === booking.body.id)).toBe(true);

    const arrived = await request(serverUrl)
      .post(`/api/v1/bookings/${booking.body.id}/arrive`)
      .set('Authorization', `Bearer ${admin}`)
      .expect(201);
    expect(arrived.body.session.status).toBe('ACTIVE');
    expect(arrived.body.booking.status).toBe('COMPLETED');

    const map = await request(serverUrl)
      .get(`/api/v1/clubs/${club.id}/seat-map`)
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);
    const tile = map.body.find((s: any) => s.id === seat.id);
    expect(tile.status).toBe('OCCUPIED');
    expect(tile.sessionId).toBe(arrived.body.session.id);

    const products = await request(serverUrl).get(`/api/v1/clubs/${club.id}/products`).expect(200);
    const order = await request(serverUrl)
      .post(`/api/v1/clubs/${club.id}/orders`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ items: [{ productId: products.body[0].id, qty: 1 }], seatId: seat.id, userId: g.id })
      .expect(201);
    const orders = await request(serverUrl)
      .get(`/api/v1/clubs/${club.id}/orders`)
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);
    expect(orders.body.some((o: any) => o.id === order.body.id)).toBe(true);
    const delivered = await request(serverUrl)
      .post(`/api/v1/clubs/${club.id}/orders/${order.body.id}/status`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ status: 'DELIVERED' })
      .expect(201);
    expect(delivered.body.status).toBe('DELIVERED');

    await request(serverUrl)
      .post(`/api/v1/sessions/${arrived.body.session.id}/stop`)
      .set('Authorization', `Bearer ${admin}`)
      .expect(201);
  });

  it('guest cannot cancel a stranger booking', async () => {
    const owner = await login(serverUrl, '+375291000002', 'owner123');
    const guest = await login(serverUrl, '+375291000004', 'guest123');
    const clubs = await request(serverUrl).get('/api/v1/clubs').expect(200);
    const club = clubs.body.find((c: any) => c.slug === 'rudemir-minsk') ?? clubs.body[0];
    const detail = await request(serverUrl).get(`/api/v1/clubs/${club.slug}`).expect(200);
    const seat = detail.body.zones[0].seats[2];
    const startsAt = new Date(Date.now() + 6 * 86400_000);
    const b = await request(serverUrl)
      .post(`/api/v1/clubs/${club.id}/bookings`)
      .set('Authorization', `Bearer ${owner}`)
      .send({
        seatId: seat.id,
        tariffId: detail.body.tariffs[0].id,
        startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + 3600_000).toISOString(),
      })
      .expect(201);
    await request(serverUrl)
      .post(`/api/v1/bookings/${b.body.id}/cancel`)
      .set('Authorization', `Bearer ${guest}`)
      .expect(400);
    await request(serverUrl)
      .post(`/api/v1/bookings/${b.body.id}/cancel`)
      .set('Authorization', `Bearer ${owner}`)
      .expect(201);
  });
});
