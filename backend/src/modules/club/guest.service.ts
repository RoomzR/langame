import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GuestService {
  constructor(private prisma: PrismaService) {}

  async resolve(
    clubId: string,
    opts: { userId?: string; name?: string; phone?: string },
  ) {
    if (opts.userId) {
      const user = await this.prisma.user.findUnique({ where: { id: opts.userId } });
      if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
      await this.touchClub(clubId, user.id);
      return user;
    }

    const name = (opts.name ?? '').trim();
    const phone = (opts.phone ?? '').replace(/\s+/g, '');
    if (phone && !phone.startsWith('walkin:')) {
      const existing = await this.prisma.user.findUnique({ where: { phone } });
      if (existing) {
        if (name && existing.displayName !== name) {
          await this.prisma.user.update({ where: { id: existing.id }, data: { displayName: name } });
        }
        await this.touchClub(clubId, existing.id);
        return existing.displayName === name || !name
          ? existing
          : { ...existing, displayName: name };
      }
      const created = await this.prisma.user.create({
        data: {
          phone,
          displayName: name || phone,
          passwordHash: await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10),
          wallet: { create: { balanceKopecks: 0 } },
        },
      });
      await this.touchClub(clubId, created.id);
      return created;
    }

    if (!name) throw new BadRequestException({ code: 'GUEST_NAME_REQUIRED' });
    const created = await this.prisma.user.create({
      data: {
        phone: `walkin:${crypto.randomUUID()}`,
        displayName: name,
        passwordHash: await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10),
        wallet: { create: { balanceKopecks: 0 } },
      },
    });
    await this.touchClub(clubId, created.id);
    return created;
  }

  displayPhone(phone?: string | null) {
    if (!phone || phone.startsWith('walkin:')) return '';
    return phone;
  }

  private async touchClub(clubId: string, userId: string) {
    const existing = await this.prisma.userClubRole.findUnique({
      where: { userId_clubId: { userId, clubId } },
    });
    if (existing) return;
    await this.prisma.userClubRole.create({
      data: { userId, clubId, role: UserRole.GUEST },
    });
  }
}
