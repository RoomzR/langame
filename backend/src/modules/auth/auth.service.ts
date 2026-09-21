import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { CardLoginDto, LoginDto, OtpVerifyDto, RegisterDto } from './dto';

@Injectable()
export class AuthService {
  private redis: Redis | null = null;
  private otpMemory = new Map<string, { code: string; exp: number }>();

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {
    const url = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    try {
      this.redis = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
      this.redis.connect().catch(() => {
        this.redis = null;
      });
    } catch {
      this.redis = null;
    }
  }

  private async setOtp(phone: string, code: string) {
    if (this.redis) {
      try {
        await this.redis.setex(`otp:${phone}`, 300, code);
        return;
      } catch {
        this.redis = null;
      }
    }
    this.otpMemory.set(phone, { code, exp: Date.now() + 300_000 });
  }

  private async getOtp(phone: string) {
    if (this.redis) {
      try {
        return await this.redis.get(`otp:${phone}`);
      } catch {
        this.redis = null;
      }
    }
    const row = this.otpMemory.get(phone);
    if (!row || row.exp < Date.now()) return null;
    return row.code;
  }

  private async delOtp(phone: string) {
    if (this.redis) {
      try {
        await this.redis.del(`otp:${phone}`);
      } catch {
        this.redis = null;
      }
    }
    this.otpMemory.delete(phone);
  }

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (exists) throw new BadRequestException({ code: 'PHONE_TAKEN' });
    const user = await this.prisma.user.create({
      data: {
        phone: dto.phone,
        passwordHash: await bcrypt.hash(dto.password, 10),
        displayName: dto.displayName,
        globalRole: UserRole.GUEST,
        wallet: { create: { balanceKopecks: 0 } },
      },
    });
    return this.issueTokens(user.id);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
    }
    return this.issueTokens(user.id);
  }

  async requestOtp(phone: string) {
    const code = this.config.get<string>('MOCK_OTP') ?? '0000';
    await this.setOtp(phone, code);
    return { sent: true, demo: process.env.NODE_ENV !== 'production' ? code : undefined };
  }

  async verifyOtp(dto: OtpVerifyDto) {
    const stored = await this.getOtp(dto.phone);
    if (!stored || stored !== dto.code) {
      throw new UnauthorizedException({ code: 'INVALID_OTP' });
    }
    await this.delOtp(dto.phone);
    let user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phone: dto.phone,
          passwordHash: await bcrypt.hash(crypto.randomBytes(12).toString('hex'), 10),
          displayName: `Guest ${dto.phone.slice(-4)}`,
          wallet: { create: { balanceKopecks: 0 } },
        },
      });
    }
    return this.issueTokens(user.id);
  }

  async loginCard(dto: CardLoginDto) {
    const card = await this.prisma.guestCard.findUnique({ where: { cardNumber: dto.cardNumber } });
    if (!card || !(await bcrypt.compare(dto.pin, card.pinHash))) {
      throw new UnauthorizedException({ code: 'INVALID_CARD' });
    }
    return this.issueTokens(card.userId);
  }

  async refresh(refreshToken: string) {
    const hash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash: hash, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!stored) throw new UnauthorizedException({ code: 'INVALID_REFRESH' });
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(stored.userId);
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: { userId, tokenHash: this.hashToken(refreshToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true, clubRoles: true },
    });
    if (!user) throw new UnauthorizedException();
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      locale: user.locale,
      globalRole: user.globalRole,
      wallet: user.wallet,
      clubRoles: user.clubRoles,
    };
  }

  private async issueTokens(userId: string) {
    const accessTtl = this.config.get<string>('JWT_ACCESS_TTL') ?? '15m';
    const refreshTtl = this.config.get<string>('JWT_REFRESH_TTL') ?? '30d';
    const accessToken = await this.jwt.signAsync(
      { sub: userId },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET') ?? 'dev-access',
        expiresIn: accessTtl,
      },
    );
    const refreshToken = crypto.randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + this.parseTtlMs(refreshTtl));
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: this.hashToken(refreshToken), expiresAt },
    });
    return { accessToken, refreshToken, expiresIn: this.parseTtlMs(accessTtl) / 1000 };
  }

  private hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private parseTtlMs(ttl: string) {
    const m = /^(\d+)([smhd])$/.exec(ttl);
    if (!m) return 15 * 60 * 1000;
    const n = Number(m[1]);
    const map: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return n * map[m[2]];
  }
}
