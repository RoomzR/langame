import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { BookingService } from './booking.service';
import { CreateBookingDto, RescheduleBookingDto } from './dto';
import { AuthUser, CurrentUser, Public, RequireClubRole } from '../../common/decorators';
import { ClubGuard } from '../../common/club.guard';

@Controller()
export class BookingController {
  constructor(private bookings: BookingService) {}

  @Public()
  @Get('seats/:seatId/availability')
  availability(
    @Param('seatId') seatId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const start = from ? new Date(from) : new Date();
    const end = to ? new Date(to) : new Date(start.getTime() + 24 * 3600_000);
    return this.bookings.availability(seatId, start, end);
  }

  @Public()
  @Get('clubs/:clubId/availability')
  clubAvailability(
    @Param('clubId') clubId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const start = from ? new Date(from) : new Date();
    const end = to ? new Date(to) : new Date(start.getTime() + 3600_000);
    return this.bookings.clubAvailability(clubId, start, end);
  }

  @Post('clubs/:clubId/bookings')
  create(
    @Param('clubId') clubId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookings.create(clubId, user.id, dto);
  }

  @Post('bookings/:bookingId/cancel')
  async cancel(@Param('bookingId') bookingId: string, @CurrentUser() user: AuthUser) {
    const isStaff = await this.bookings.isStaffFor(bookingId, user);
    return this.bookings.cancel(bookingId, user.id, isStaff);
  }

  @Post('bookings/:bookingId/arrive')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  arrive(@Param('bookingId') bookingId: string) {
    return this.bookings.arrive(bookingId);
  }

  @Post('bookings/:bookingId/reschedule')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  reschedule(@Param('bookingId') bookingId: string, @Body() dto: RescheduleBookingDto) {
    return this.bookings.reschedule(bookingId, new Date(dto.startsAt), new Date(dto.endsAt));
  }

  @Get('me/bookings')
  mine(@CurrentUser() user: AuthUser) {
    return this.bookings.listMine(user.id);
  }

  @Get('clubs/:clubId/bookings')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  club(@Param('clubId') clubId: string, @Query('all') all?: string) {
    return this.bookings.listClub(clubId, all === '1' || all === 'true');
  }
}
