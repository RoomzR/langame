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
import { SessionService } from './session.service';
import { ExtendSessionDto, StartSessionDto, TransferSessionDto } from './dto';
import { AuthUser, CurrentUser, RequireClubRole } from '../../common/decorators';
import { ClubGuard } from '../../common/club.guard';
import { IsOptional, IsString } from 'class-validator';

class HeartbeatDto {
  @IsOptional()
  @IsString()
  currentProcess?: string;
}

class CallAdminDto {
  @IsOptional()
  @IsString()
  message?: string;
}

class PcCommandDto {
  @IsString()
  command: string;
}

class ChatDto {
  @IsString()
  body: string;
  @IsOptional()
  @IsString()
  seatId?: string;
}

@Controller()
export class SessionController {
  constructor(private sessions: SessionService) {}

  @Post('clubs/:clubId/sessions')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  start(@Param('clubId') clubId: string, @Body() dto: StartSessionDto) {
    return this.sessions.start(clubId, dto);
  }

  @Post('sessions/:sessionId/pause')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  pause(@Param('sessionId') sessionId: string) {
    return this.sessions.pause(sessionId);
  }

  @Post('sessions/:sessionId/resume')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  resume(@Param('sessionId') sessionId: string) {
    return this.sessions.resume(sessionId);
  }

  @Post('sessions/:sessionId/stop')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  stop(@Param('sessionId') sessionId: string) {
    return this.sessions.stop(sessionId);
  }

  @Post('sessions/:sessionId/extend')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  extend(@Param('sessionId') sessionId: string, @Body() dto: ExtendSessionDto) {
    return this.sessions.extend(sessionId, dto.minutes);
  }

  @Post('sessions/:sessionId/transfer')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  transfer(@Param('sessionId') sessionId: string, @Body() dto: TransferSessionDto) {
    return this.sessions.transfer(sessionId, dto.toSeatId);
  }

  @Post('seats/:seatId/heartbeat')
  heartbeat(@Param('seatId') seatId: string, @Body() dto: HeartbeatDto) {
    return this.sessions.heartbeat(seatId, dto.currentProcess);
  }

  @Post('clubs/:clubId/seats/:seatId/call')
  callAdmin(
    @Param('clubId') clubId: string,
    @Param('seatId') seatId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CallAdminDto,
  ) {
    return this.sessions.callAdmin(clubId, seatId, user.id, dto.message);
  }

  @Post('clubs/:clubId/seats/:seatId/command')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  command(
    @Param('clubId') clubId: string,
    @Param('seatId') seatId: string,
    @Body() dto: PcCommandDto,
  ) {
    return this.sessions.pcCommand(clubId, seatId, dto.command);
  }

  @Get('me/sessions')
  mine(@CurrentUser() user: AuthUser) {
    return this.sessions.listMine(user.id);
  }

  @Get('clubs/:clubId/calls')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  calls(@Param('clubId') clubId: string, @Query('open') open?: string) {
    return this.sessions.listCalls(clubId, open !== '0' && open !== 'false');
  }

  @Post('clubs/:clubId/calls/:callId/resolve')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  resolve(@Param('clubId') clubId: string, @Param('callId') callId: string) {
    return this.sessions.resolveCall(clubId, callId);
  }

  @Get('clubs/:clubId/chat')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  chat(@Param('clubId') clubId: string, @Query('seatId') seatId?: string) {
    return this.sessions.chatHistory(clubId, seatId);
  }

  @Post('clubs/:clubId/chat')
  sendChat(
    @Param('clubId') clubId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ChatDto,
  ) {
    return this.sessions.sendChat(clubId, user.id, dto.body, dto.seatId);
  }
}
