import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { UserRole } from '@prisma/client';
import { LockerService } from './locker.service';
import { RequireClubRole } from '../../common/decorators';
import { ClubGuard } from '../../common/club.guard';

class OccupyDto {
  @IsString()
  guestUserId: string;
}

@Controller('clubs/:clubId/lockers')
@UseGuards(ClubGuard)
@RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
export class LockerController {
  constructor(private lockers: LockerService) {}

  @Get()
  list(@Param('clubId') clubId: string) {
    return this.lockers.list(clubId);
  }

  @Post(':lockerId/occupy')
  occupy(
    @Param('clubId') clubId: string,
    @Param('lockerId') lockerId: string,
    @Body() dto: OccupyDto,
  ) {
    return this.lockers.occupy(clubId, lockerId, dto.guestUserId);
  }

  @Post(':lockerId/release')
  release(@Param('clubId') clubId: string, @Param('lockerId') lockerId: string) {
    return this.lockers.release(clubId, lockerId);
  }
}
