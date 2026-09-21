import { BadRequestException, Injectable } from '@nestjs/common';
import { LockerStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LockerService {
  constructor(private prisma: PrismaService) {}

  list(clubId: string) {
    return this.prisma.locker.findMany({ where: { clubId }, orderBy: { number: 'asc' } });
  }

  async occupy(clubId: string, lockerId: string, guestUserId: string) {
    const locker = await this.prisma.locker.findFirst({ where: { id: lockerId, clubId } });
    if (!locker || locker.status === LockerStatus.OCCUPIED) {
      throw new BadRequestException({ code: 'LOCKER_BUSY' });
    }
    return this.prisma.locker.update({
      where: { id: lockerId },
      data: { status: LockerStatus.OCCUPIED, guestUserId, occupiedAt: new Date() },
    });
  }

  async release(clubId: string, lockerId: string) {
    return this.prisma.locker.update({
      where: { id: lockerId },
      data: { status: LockerStatus.FREE, guestUserId: null, occupiedAt: null },
    });
  }
}
