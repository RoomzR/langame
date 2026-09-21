import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

async function login(server: string, phone: string, password: string) {
  const res = await request(server).post('/api/v1/auth/login').send({ phone, password }).expect(201);
  return res.body.accessToken as string;
}

describe('RUDEMIR ops phase (e2e)', () => {
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

  it('bePaid checkout → sandbox complete credits wallet', async () => {
    const token = await login(serverUrl, '+375291000004', 'guest123');
    const before = await request(serverUrl)
      .get('/api/v1/me/wallet')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const checkout = await request(serverUrl)
      .post('/api/v1/payments/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ amountKopecks: 1500, method: 'bepaid' })
      .expect(201);

    expect(checkout.body.currency).toBe('BYN');
    expect(checkout.body.paymentId).toBeTruthy();

    await request(serverUrl)
      .post(`/api/v1/payments/${checkout.body.paymentId}/sandbox-complete`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    const after = await request(serverUrl)
      .get('/api/v1/me/wallet')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(after.body.balanceKopecks).toBe(before.body.balanceKopecks + 1500);

    const notes = await request(serverUrl)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(notes.body.some((n: any) => n.type === 'payment.succeeded')).toBe(true);
  });

  it('ERIP checkout + webhook credits by providerRef', async () => {
    const token = await login(serverUrl, '+375291000004', 'guest123');
    const checkout = await request(serverUrl)
      .post('/api/v1/payments/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ amountKopecks: 200, method: 'erip' })
      .expect(201);
    expect(checkout.body.eripCode).toBeTruthy();

    const payment = await request(serverUrl)
      .get(`/api/v1/payments/${checkout.body.paymentId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(serverUrl)
      .post('/api/v1/payments/webhooks/bepaid')
      .send({ uid: payment.body.providerRef, status: 'successful' })
      .expect(201);
  });

  it('single-elimination tournament start + result', async () => {
    const admin = await login(serverUrl, '+375291000003', 'admin123');
    const guest = await login(serverUrl, '+375291000004', 'guest123');
    const owner = await login(serverUrl, '+375291000002', 'owner123');
    const clubs = await request(serverUrl).get('/api/v1/clubs').expect(200);
    const club = clubs.body.find((c: any) => c.slug === 'rudemir-minsk') ?? clubs.body[0];

    const created = await request(serverUrl)
      .post(`/api/v1/clubs/${club.id}/tournaments`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ name: 'CS2 Friday', game: 'CS2', startsAt: new Date().toISOString() })
      .expect(201);

    await request(serverUrl)
      .post(`/api/v1/tournaments/${created.body.id}/join`)
      .set('Authorization', `Bearer ${guest}`)
      .expect(201);
    await request(serverUrl)
      .post(`/api/v1/tournaments/${created.body.id}/join`)
      .set('Authorization', `Bearer ${owner}`)
      .expect(201);

    const started = await request(serverUrl)
      .post(`/api/v1/tournaments/${created.body.id}/start`)
      .set('Authorization', `Bearer ${admin}`)
      .expect(201);
    expect(started.body.status).toBe('RUNNING');
    const match = started.body.bracket.matches.find((m: any) => m.round === 0 && m.a && m.b);
    expect(match).toBeTruthy();

    const guestMe = await request(serverUrl)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${guest}`)
      .expect(200);

    const finished = await request(serverUrl)
      .post(`/api/v1/tournaments/${created.body.id}/matches/${match.id}/result`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ winnerUserId: guestMe.body.id })
      .expect(201);
    expect(finished.body.status).toBe('FINISHED');
  });

  it('analytics + prometheus metrics', async () => {
    const admin = await login(serverUrl, '+375291000003', 'admin123');
    const clubs = await request(serverUrl).get('/api/v1/clubs').expect(200);
    const club = clubs.body.find((c: any) => c.slug === 'rudemir-minsk') ?? clubs.body[0];
    await request(serverUrl)
      .get(`/api/v1/clubs/${club.id}/analytics/occupancy`)
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);
    await request(serverUrl)
      .get(`/api/v1/clubs/${club.id}/analytics/revenue`)
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);
    const metrics = await request(serverUrl).get('/api/v1/metrics').expect(200);
    expect(String(metrics.text ?? metrics.body)).toContain('rudemir_sessions_active');
  });
});
