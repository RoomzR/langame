import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { AuthUser, CurrentUser, RequireClubRole, StaffAny } from '../../common/decorators';
import { ClubGuard } from '../../common/club.guard';
import { OpsService } from './ops.service';
import { ASSIGNABLE_CLUB_ROLES, type RoleName } from '../../common/acl';

class NameDto {
  @IsString()
  name: string;
}

class BindDto {
  @IsString()
  seatId: string;
  @IsOptional()
  @IsString()
  pcTypeId?: string;
}

class StaffFullDto {
  @IsString()
  phone: string;
  @IsString()
  displayName: string;
  @IsString()
  password: string;
  @IsString()
  role: string;
  @IsOptional()
  @IsString()
  login?: string;
  @IsOptional()
  @IsString()
  workPoint?: string;
  @IsOptional()
  @IsString()
  schedule?: string;
  @IsOptional()
  @IsInt()
  wageKopecks?: number;
}

class AutobonusDto {
  @IsString()
  name: string;
  @IsInt()
  percent: number;
  @IsOptional()
  @IsInt()
  minSpendKopecks?: number;
}

class BlacklistDto {
  @IsString()
  phone: string;
  @IsOptional()
  @IsString()
  reason?: string;
}

class CertDto {
  @IsInt()
  @Min(1)
  amountKopecks: number;
  @IsOptional()
  @IsString()
  code?: string;
}

class PromoDto {
  @IsString()
  code: string;
  @IsInt()
  percent: number;
}

class TicketDto {
  @IsString()
  title: string;
  @IsOptional()
  @IsString()
  body?: string;
}

class CommandDto {
  @IsString()
  command: string;
  @IsOptional()
  @IsString()
  seatId?: string;
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

@Controller('clubs/:clubId')
@UseGuards(ClubGuard)
@RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
export class OpsController {
  constructor(private ops: OpsService) {}

  @Get('access')
  @StaffAny()
  async access(@Param('clubId') clubId: string, @CurrentUser() user: AuthUser, @Query() _q: any) {
    return this.ops.access(clubId, user);
  }

  @Patch('rights')
  patchRights(@Param('clubId') clubId: string, @CurrentUser() user: AuthUser, @Body() body: { matrix?: Record<string, string[]> }) {
    return this.ops.patchRights(clubId, user, body.matrix ?? {});
  }

  @Get('settings')
  settings(@Param('clubId') clubId: string) {
    return this.ops.settings(clubId);
  }

  @Patch('settings')
  @UsePipes(new ValidationPipe({ whitelist: false, transform: true }))
  patchSettings(@Param('clubId') clubId: string, @Body() dto: Record<string, unknown>) {
    return this.ops.patchSettings(clubId, dto);
  }

  @Get('pc-types')
  pcTypes(@Param('clubId') clubId: string) {
    return this.ops.pcTypes(clubId);
  }

  @Post('pc-types')
  createPcType(@Param('clubId') clubId: string, @Body() dto: NameDto) {
    return this.ops.createPcType(clubId, dto.name);
  }

  @Post('pc-types/bind')
  bind(@Body() dto: BindDto) {
    return this.ops.bindSeat(dto.seatId, dto.pcTypeId || null);
  }

  @Get('staff/full')
  staffFull(@Param('clubId') clubId: string, @Query('dismissed') dismissed?: string) {
    return this.ops.staff(clubId, dismissed === '1');
  }

  @Post('staff/full')
  addStaff(@Param('clubId') clubId: string, @CurrentUser() user: AuthUser, @Body() dto: StaffFullDto) {
    if (!ASSIGNABLE_CLUB_ROLES.includes(dto.role as RoleName)) {
      throw new BadRequestException({ code: 'ROLE_INVALID' });
    }
    return this.ops.upsertStaff(clubId, user, dto);
  }

  @Post('staff/:userId/dismiss')
  dismiss(@Param('clubId') clubId: string, @CurrentUser() user: AuthUser, @Param('userId') userId: string) {
    return this.ops.dismissStaff(clubId, user, userId);
  }

  @Get('guest-groups')
  groups(@Param('clubId') clubId: string) {
    return this.ops.groups(clubId);
  }

  @Post('guest-groups')
  group(@Param('clubId') clubId: string, @Body() dto: NameDto) {
    return this.ops.createGroup(clubId, dto.name);
  }

  @Get('autobonus')
  autobonus(@Param('clubId') clubId: string) {
    return this.ops.autobonus(clubId);
  }

  @Post('autobonus')
  createAutobonus(@Param('clubId') clubId: string, @Body() dto: AutobonusDto) {
    return this.ops.createAutobonus(clubId, dto);
  }

  @Get('blacklist')
  blacklist(@Param('clubId') clubId: string) {
    return this.ops.blacklist(clubId);
  }

  @Post('blacklist')
  addBlack(@Param('clubId') clubId: string, @Body() dto: BlacklistDto) {
    return this.ops.addBlacklist(clubId, dto.phone, dto.reason ?? '');
  }

  @Get('gift-certs')
  certs(@Param('clubId') clubId: string) {
    return this.ops.certs(clubId);
  }

  @Post('gift-certs')
  cert(@Param('clubId') clubId: string, @Body() dto: CertDto) {
    return this.ops.createCert(clubId, dto.amountKopecks, dto.code);
  }

  @Get('promos')
  promos(@Param('clubId') clubId: string) {
    return this.ops.promos(clubId);
  }

  @Post('promos')
  promo(@Param('clubId') clubId: string, @Body() dto: PromoDto) {
    return this.ops.createPromo(clubId, dto.code, dto.percent);
  }

  @Get('guest-events')
  events(@Param('clubId') clubId: string, @Query('kind') kind?: string) {
    return this.ops.events(clubId, kind);
  }

  @Get('guest-table')
  table(
    @Param('clubId') clubId: string,
    @Query('q') q?: string,
    @Query('groupId') groupId?: string,
  ) {
    return this.ops.guestTable(clubId, { q, groupId });
  }

  @Get('tickets')
  tickets(@Param('clubId') clubId: string) {
    return this.ops.tickets(clubId);
  }

  @Post('tickets')
  ticket(@Param('clubId') clubId: string, @CurrentUser() user: AuthUser, @Body() dto: TicketDto) {
    return this.ops.createTicket(clubId, user.id, dto.title, dto.body ?? '');
  }

  @Post('tickets/:id/resolve')
  resolve(@Param('id') id: string) {
    return this.ops.resolveTicket(id);
  }

  @Get('agent-commands')
  commands(@Param('clubId') clubId: string) {
    return this.ops.commands(clubId);
  }

  @Post('agent-commands')
  cmd(@Param('clubId') clubId: string, @Body() dto: CommandDto) {
    return this.ops.enqueueCommand(clubId, dto.command, dto.seatId, dto.payload ?? {});
  }

  @Post('seats/:seatId/pair')
  @StaffAny()
  pair(@Param('clubId') clubId: string, @Param('seatId') seatId: string) {
    return this.ops.pairSeat(clubId, seatId);
  }

  @Get('payroll')
  payroll(@Param('clubId') clubId: string) {
    return this.ops.payroll(clubId);
  }

  @Get('booking-quote')
  quote(
    @Param('clubId') clubId: string,
    @Query('seatId') seatId: string,
    @Query('tariffId') tariffId: string,
    @Query('startsAt') startsAt: string,
    @Query('endsAt') endsAt: string,
  ) {
    return this.ops.quote(clubId, seatId, tariffId, startsAt, endsAt);
  }
}
