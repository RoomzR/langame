import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser, CurrentUser, Public, RequireGlobalRole } from '../../common/decorators';
import { GlobalRoleGuard } from '../../common/roles.guard';
import { MARKET } from '../../common/market';

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  displayName?: string;
  @IsOptional()
  @IsString()
  locale?: string;
}

@Controller()
export class UserController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get('meta')
  meta() {
    return MARKET;
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: user.id },
      data: dto,
      select: { id: true, displayName: true, locale: true, phone: true },
    });
  }

  @Get('users')
  @UseGuards(GlobalRoleGuard)
  @RequireGlobalRole(UserRole.SUPERADMIN, UserRole.SUPPORT)
  search(@Query('q') q?: string) {
    return this.prisma.user.findMany({
      where: q
        ? {
            OR: [
              { phone: { contains: q } },
              { displayName: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      take: 20,
      select: { id: true, phone: true, displayName: true, globalRole: true },
    });
  }

  @Public()
  @Get('news')
  news() {
    return this.prisma.newsArticle.findMany({ orderBy: { publishedAt: 'desc' }, take: 20 });
  }

  @Public()
  @Get('news/:slug')
  article(@Param('slug') slug: string) {
    return this.prisma.newsArticle.findUnique({ where: { slug } });
  }
}
