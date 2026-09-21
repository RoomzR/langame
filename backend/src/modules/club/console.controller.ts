import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser, CurrentUser, RequireClubRole } from '../../common/decorators';
import { ClubGuard } from '../../common/club.guard';
import { GuestService } from './guest.service';
import { NotificationService } from '../notification/notification.service';

class StaffDto {
  @IsString()
  phone: string;
  @IsString()
  displayName: string;
  @IsString()
  @MinLength(6)
  password: string;
  @IsIn(['CASHIER', 'BARTENDER', 'CLUB_ADMIN', 'TECH_ADMIN', 'MANAGER', 'OWNER'])
  role: string;
}

class WalkInGuestDto {
  @IsString()
  displayName: string;
  @IsOptional()
  @IsString()
  phone?: string;
}

class GameAccountDto {
  @IsString()
  guestName: string;
  @IsString()
  platform: string;
  @IsString()
  login: string;
  @IsOptional()
  @IsString()
  note?: string;
  @IsOptional()
  @IsString()
  userId?: string;
}

class NewsDto {
  @IsString()
  title: string;
  @IsOptional()
  @IsString()
  excerpt?: string;
  @IsOptional()
  @IsString()
  body?: string;
}

class MailDto {
  @IsString()
  title: string;
  @IsString()
  body: string;
}

class ModulesDto {
  @IsObject()
  modules: Record<string, boolean>;
}

@Controller('clubs/:clubId')
@UseGuards(ClubGuard)
@RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
export class ConsoleController {
  constructor(
    private prisma: PrismaService,
    private guests: GuestService,
    private notifications: NotificationService,
  ) {}

  @Get('staff')
  staff(@Param('clubId') clubId: string) {
    return this.prisma.userClubRole.findMany({
      where: { clubId, role: { not: UserRole.GUEST } },
      include: { user: { select: { id: true, displayName: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('staff')
  @RequireClubRole(UserRole.OWNER)
  async addStaff(@Param('clubId') clubId: string, @Body() dto: StaffDto) {
    let user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phone: dto.phone,
          displayName: dto.displayName,
          passwordHash: await bcrypt.hash(dto.password, 10),
          globalRole: UserRole.GUEST,
          wallet: { create: { balanceKopecks: 0 } },
        },
      });
    }
    return this.prisma.userClubRole.upsert({
      where: { userId_clubId: { userId: user.id, clubId } },
      create: { userId: user.id, clubId, role: dto.role as UserRole },
      update: { role: dto.role as UserRole },
      include: { user: { select: { id: true, displayName: true, phone: true } } },
    });
  }

  @Delete('staff/:userId')
  @RequireClubRole(UserRole.OWNER)
  async removeStaff(@Param('clubId') clubId: string, @Param('userId') userId: string) {
    await this.prisma.userClubRole.deleteMany({
      where: { clubId, userId, role: { not: UserRole.GUEST } },
    });
    return { ok: true };
  }

  @Post('walk-in')
  walkIn(@Param('clubId') clubId: string, @Body() dto: WalkInGuestDto) {
    return this.guests.resolve(clubId, { name: dto.displayName, phone: dto.phone });
  }

  @Get('game-accounts')
  accounts(@Param('clubId') clubId: string) {
    return this.prisma.gameAccount.findMany({
      where: { clubId },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, displayName: true, phone: true } } },
    });
  }

  @Post('game-accounts')
  createAccount(@Param('clubId') clubId: string, @Body() dto: GameAccountDto) {
    return this.prisma.gameAccount.create({
      data: {
        clubId,
        guestName: dto.guestName,
        platform: dto.platform,
        login: dto.login,
        note: dto.note ?? '',
        userId: dto.userId,
      },
    });
  }

  @Delete('game-accounts/:id')
  async deleteAccount(@Param('clubId') clubId: string, @Param('id') id: string) {
    await this.prisma.gameAccount.deleteMany({ where: { id, clubId } });
    return { ok: true };
  }

  @Post('news')
  createNews(@Body() dto: NewsDto) {
    const slug = `club-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    return this.prisma.newsArticle.create({
      data: {
        slug,
        title: dto.title,
        excerpt: dto.excerpt ?? '',
        body: dto.body ?? '',
      },
    });
  }

  @Post('mailings')
  async mail(
    @Param('clubId') clubId: string,
    @CurrentUser() actor: AuthUser,
    @Body() dto: MailDto,
  ) {
    const roles = await this.prisma.userClubRole.findMany({
      where: { clubId, role: UserRole.GUEST },
      select: { userId: true, user: { select: { phone: true } } },
    });
    let sent = 0;
    for (const row of roles) {
      if (row.user.phone.startsWith('walkin:')) continue;
      await this.notifications.push(row.userId, 'club.mailing', dto.title, dto.body, { clubId });
      sent += 1;
    }
    await this.prisma.adminActionLog.create({
      data: {
        clubId,
        userId: actor.id,
        action: 'MAILING',
        payload: { title: dto.title, sent },
      },
    });
    return { sent };
  }

  @Patch('modules')
  modules(@Param('clubId') clubId: string, @Body() dto: ModulesDto) {
    return this.prisma.club.update({
      where: { id: clubId },
      data: { modules: dto.modules },
      select: { id: true, modules: true },
    });
  }
}
