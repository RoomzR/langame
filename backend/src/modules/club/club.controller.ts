import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ClubService } from './club.service';
import {
  ClubQueryDto,
  CreateClubDto,
  CreateHardwareDto,
  CreateOrganizationDto,
  CreateSeatDto,
  CreateTariffDto,
  CreateZoneDto,
  UpdateClubDto,
  UpdateSeatDto,
} from './dto';
import { Public, RequireClubRole, CurrentUser, AuthUser } from '../../common/decorators';
import { ClubGuard } from '../../common/club.guard';

@Controller()
export class ClubController {
  constructor(private clubs: ClubService) {}

  @Public()
  @Get('clubs')
  list(@Query() query: ClubQueryDto) {
    return this.clubs.listClubs(query);
  }

  @Public()
  @Get('clubs/:idOrSlug')
  get(@Param('idOrSlug') idOrSlug: string) {
    return this.clubs.getClub(idOrSlug);
  }

  @Post('organizations')
  @RequireClubRole(UserRole.SUPERADMIN)
  @UseGuards(ClubGuard)
  createOrg(@Body() dto: CreateOrganizationDto) {
    return this.clubs.createOrg(dto);
  }

  @Post('clubs')
  createClub(@CurrentUser() user: AuthUser, @Body() dto: CreateClubDto) {
    return this.clubs.createClub(user, dto);
  }

  @Patch('clubs/:clubId')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  updateClub(@Param('clubId') clubId: string, @Body() dto: UpdateClubDto) {
    return this.clubs.updateClub(clubId, dto);
  }

  @Post('clubs/:clubId/zones')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  createZone(@Param('clubId') clubId: string, @Body() dto: CreateZoneDto) {
    return this.clubs.createZone(clubId, dto);
  }

  @Post('clubs/:clubId/zones/:zoneId/seats')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  createSeat(
    @Param('clubId') clubId: string,
    @Param('zoneId') zoneId: string,
    @Body() dto: CreateSeatDto,
  ) {
    return this.clubs.createSeat(clubId, zoneId, dto);
  }

  @Patch('seats/:seatId')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  updateSeat(@Param('seatId') seatId: string, @Body() dto: UpdateSeatDto) {
    return this.clubs.updateSeat(seatId, dto);
  }

  @Post('clubs/:clubId/tariffs')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  createTariff(@Param('clubId') clubId: string, @Body() dto: CreateTariffDto) {
    return this.clubs.createTariff(clubId, dto);
  }

  @Get('clubs/:clubId/seat-map')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  seatMap(@Param('clubId') clubId: string) {
    return this.clubs.seatMap(clubId);
  }

  @Get('clubs/:clubId/guests')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  guests(@Param('clubId') clubId: string, @Query('q') q?: string) {
    return this.clubs.guests(clubId, q);
  }

  @Public()
  @Get('clubs/:clubId/hardware')
  hardware(@Param('clubId') clubId: string) {
    return this.clubs.hardware(clubId);
  }

  @Post('clubs/:clubId/hardware')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  createHardware(@Param('clubId') clubId: string, @Body() dto: CreateHardwareDto) {
    return this.clubs.createHardware(clubId, dto);
  }
}
