import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

async function login(server: string, phone: string, password: string) {
  const res = await request(server).post('/api/v1/auth/login').send({ phone, password }).expect(201);
  return res.body.accessToken as string;
}

describe('RUDEMIR social / floor phase (e2e)', () => {
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

  it('guest card login + admin card lookup', async () => {
    const tokens = await request(serverUrl)
      .post('/api/v1/auth/card')
      .send({ cardNumber: '10000004', pin: '1234' })
      .expect(201);
    expect(tokens.body.accessToken).toBeTruthy();

    const admin = await login(serverUrl, '+375291000003', 'admin123');
    const clubs = await request(serverUrl).get('/api/v1/clubs').expect(200);
    const club = clubs.body.find((c: any) => c.slug === 'rudemir-minsk') ?? clubs.body[0];
    const card = await request(serverUrl)
      .get(`/api/v1/clubs/${club.id}/guest-cards/10000004`)
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);
    expect(card.body.phone).toBe('+375291000004');
  });

  it('friends request → accept', async () => {
    const phone = `+37529${String(Date.now()).slice(-7)}`;
    const created = await request(serverUrl)
      .post('/api/v1/auth/register')
      .send({ phone, password: 'friend12', displayName: 'Друг теста' })
      .expect(201);
    const guest = await login(serverUrl, '+375291000004', 'guest123');
    const peer = await request(serverUrl)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${created.body.accessToken}`)
      .expect(200);

    const reqFriend = await request(serverUrl)
      .post('/api/v1/me/friends')
      .set('Authorization', `Bearer ${guest}`)
      .send({ userId: peer.body.id })
      .expect(201);
    expect(reqFriend.body.status).toBe('PENDING');

    await request(serverUrl)
      .post(`/api/v1/me/friends/${reqFriend.body.id}/accept`)
      .set('Authorization', `Bearer ${created.body.accessToken}`)
      .expect(201);

    const list = await request(serverUrl)
      .get('/api/v1/me/friends')
      .set('Authorization', `Bearer ${guest}`)
      .expect(200);
    expect(list.body.some((f: any) => f.status === 'ACCEPTED' && f.peer.id === peer.body.id)).toBe(true);
  });

  it('admin call + chat + bonus + review', async () => {
    const guest = await login(serverUrl, '+375291000004', 'guest123');
    const admin = await login(serverUrl, '+375291000003', 'admin123');
    const clubs = await request(serverUrl).get('/api/v1/clubs').expect(200);
    const club = clubs.body.find((c: any) => c.slug === 'rudemir-minsk') ?? clubs.body[0];
    const detail = await request(serverUrl).get(`/api/v1/clubs/${club.slug}`).expect(200);
    const seat = detail.body.zones[0].seats[0];
    const me = await request(serverUrl).get('/api/v1/auth/me').set('Authorization', `Bearer ${guest}`).expect(200);

    const call = await request(serverUrl)
      .post(`/api/v1/clubs/${club.id}/seats/${seat.id}/call`)
      .set('Authorization', `Bearer ${guest}`)
      .send({ message: 'клавиатура' })
      .expect(201);

    const open = await request(serverUrl)
      .get(`/api/v1/clubs/${club.id}/calls`)
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);
    expect(open.body.some((c: any) => c.id === call.body.id)).toBe(true);

    await request(serverUrl)
      .post(`/api/v1/clubs/${club.id}/calls/${call.body.id}/resolve`)
      .set('Authorization', `Bearer ${admin}`)
      .expect(201);

    await request(serverUrl)
      .post(`/api/v1/clubs/${club.id}/chat`)
      .set('Authorization', `Bearer ${guest}`)
      .send({ seatId: seat.id, body: 'Нужна помощь с мышью' })
      .expect(201);

    const chat = await request(serverUrl)
      .get(`/api/v1/clubs/${club.id}/chat?seatId=${seat.id}`)
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);
    expect(chat.body.some((m: any) => m.body.includes('мышью'))).toBe(true);

    const before = await request(serverUrl)
      .get('/api/v1/me/wallet')
      .set('Authorization', `Bearer ${guest}`)
      .expect(200);
    await request(serverUrl)
      .post(`/api/v1/clubs/${club.id}/wallets/${me.body.id}/bonus`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ amountKopecks: 250 })
      .expect(201);
    const redeemed = await request(serverUrl)
      .post('/api/v1/me/wallet/redeem-bonus')
      .set('Authorization', `Bearer ${guest}`)
      .send({})
      .expect(201);
    expect(redeemed.body.balanceKopecks).toBeGreaterThanOrEqual(before.body.balanceKopecks + 250);
    expect(redeemed.body.bonusKopecks).toBe(0);

    await request(serverUrl)
      .post(`/api/v1/clubs/${club.id}/reviews`)
      .set('Authorization', `Bearer ${guest}`)
      .send({ rating: 5, text: 'Отличный клуб' })
      .expect(201);

    const catalog = await request(serverUrl).get('/api/v1/achievements').expect(200);
    expect(catalog.body.some((a: any) => a.code === 'first_topup')).toBe(true);
  });
});
