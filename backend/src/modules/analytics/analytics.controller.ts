import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from './analytics.service';
import { AuthUser, CurrentUser, RequireClubRole } from '../../common/decorators';
import { ClubGuard } from '../../common/club.guard';

@Controller('clubs/:clubId')
@UseGuards(ClubGuard)
@RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
export class AnalyticsController {
  constructor(
    private analytics: AnalyticsService,
    private prisma: PrismaService,
  ) {}

  @Get('analytics/overview')
  overview(
    @Param('clubId') clubId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.overview(
      clubId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Get('analytics/occupancy')
  occupancy(@Param('clubId') clubId: string, @Query('hours') hours?: string) {
    return this.analytics.occupancy(clubId, hours ? Number(hours) : 24);
  }

  @Get('analytics/revenue')
  revenue(@Param('clubId') clubId: string, @Query('days') days?: string) {
    return this.analytics.revenue(clubId, days ? Number(days) : 7);
  }

  @Get('analytics/retention')
  retention(@Param('clubId') clubId: string) {
    return this.analytics.retention(clubId);
  }

  @Get('analytics/visits')
  visits(@Param('clubId') clubId: string, @Query('days') days?: string) {
    return this.analytics.visits(clubId, days ? Number(days) : 30);
  }

  @Get('analytics/shift-report')
  shiftReport(@Param('clubId') clubId: string, @Query('shiftId') shiftId?: string) {
    return this.analytics.shiftReport(clubId, shiftId);
  }

  @Get('analytics/admin-log')
  adminLog(@Param('clubId') clubId: string) {
    return this.prisma.adminActionLog.findMany({
      where: { clubId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { displayName: true, phone: true } } },
    });
  }

  @Get('shifts')
  shifts(@Param('clubId') clubId: string) {
    return this.analytics.listShifts(clubId);
  }

  @Post('shifts/open')
  open(@Param('clubId') clubId: string, @CurrentUser() user: AuthUser) {
    return this.analytics.openShift(clubId, user.id);
  }

  @Post('shifts/:shiftId/close')
  close(
    @Param('clubId') clubId: string,
    @Param('shiftId') shiftId: string,
    @CurrentUser() user: AuthUser,
    @Body() body?: Record<string, string>,
  ) {
    return this.analytics.closeShift(clubId, shiftId, user.id, body);
  }
}

@Controller('analytics')
@UseGuards(ClubGuard)
@RequireClubRole(UserRole.SUPERADMIN)
export class NetworkAnalyticsController {
  constructor(private analytics: AnalyticsService) {}

  @Get('network')
  network(
    @Query('days') days?: string,
    @Query('grain') grain?: string,
    @Query('date') date?: string,
  ) {
    return this.analytics.network(days ? Number(days) : 30, grain, date);
  }
}
