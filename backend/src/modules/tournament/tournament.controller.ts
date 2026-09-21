import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsDateString, IsOptional, IsString } from 'class-validator';
import { UserRole } from '@prisma/client';
import { TournamentService } from './tournament.service';
import { AuthUser, CurrentUser, Public, RequireClubRole } from '../../common/decorators';
import { ClubGuard } from '../../common/club.guard';

class CreateTournamentDto {
  @IsString()
  name: string;
  @IsOptional()
  @IsString()
  game?: string;
  @IsDateString()
  startsAt: string;
}

class ReportMatchDto {
  @IsString()
  winnerUserId: string;
}

@Controller()
export class TournamentController {
  constructor(private tournaments: TournamentService) {}

  @Public()
  @Get('clubs/:clubId/tournaments')
  list(@Param('clubId') clubId: string) {
    return this.tournaments.list(clubId);
  }

  @Public()
  @Get('tournaments/:tournamentId')
  get(@Param('tournamentId') id: string) {
    return this.tournaments.get(id);
  }

  @Post('clubs/:clubId/tournaments')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  create(@Param('clubId') clubId: string, @Body() dto: CreateTournamentDto) {
    return this.tournaments.create(clubId, {
      name: dto.name,
      game: dto.game,
      startsAt: new Date(dto.startsAt),
    });
  }

  @Post('tournaments/:tournamentId/join')
  join(@Param('tournamentId') id: string, @CurrentUser() user: AuthUser) {
    return this.tournaments.join(id, user.id);
  }

  @Post('tournaments/:tournamentId/start')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  start(@Param('tournamentId') id: string) {
    return this.tournaments.start(id);
  }

  @Post('tournaments/:tournamentId/matches/:matchId/result')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  result(
    @Param('tournamentId') id: string,
    @Param('matchId') matchId: string,
    @Body() dto: ReportMatchDto,
  ) {
    return this.tournaments.reportWinner(id, matchId, dto.winnerUserId);
  }
}
