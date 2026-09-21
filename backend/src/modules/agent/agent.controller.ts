import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators';
import { AgentAuthGuard } from './agent.auth.guard';
import { AgentService } from './agent.service';
import { AgentPrincipal } from './agent.types';

class EnrollDto {
  @IsString()
  clubId: string;
  @IsString()
  seatId: string;
  @IsString()
  code: string;
  @IsOptional()
  @IsString()
  hostname?: string;
  @IsOptional()
  @IsString()
  version?: string;
}

class HeartbeatDto {
  @IsOptional()
  @IsString()
  currentProcess?: string;
  @IsOptional()
  @IsNumber()
  cpuTemp?: number;
  @IsOptional()
  @IsString()
  version?: string;
  @IsOptional()
  @IsString()
  hostname?: string;
}

class AckDto {
  @IsIn(['DONE', 'FAILED'])
  status: 'DONE' | 'FAILED';
  @IsOptional()
  @IsString()
  result?: string;
}

@SkipThrottle()
@Controller('agent')
export class AgentController {
  constructor(private agents: AgentService) {}

  @Public()
  @Post('enroll')
  enroll(@Body() dto: EnrollDto) {
    return this.agents.enroll(dto);
  }

  @Public()
  @UseGuards(AgentAuthGuard)
  @Post('heartbeat')
  heartbeat(@Req() req: { agent: AgentPrincipal }, @Body() dto: HeartbeatDto) {
    return this.agents.heartbeat(req.agent, dto);
  }

  @Public()
  @UseGuards(AgentAuthGuard)
  @Get('commands')
  commands(@Req() req: { agent: AgentPrincipal }) {
    return this.agents.consume(req.agent);
  }

  @Public()
  @UseGuards(AgentAuthGuard)
  @Post('commands/:id/ack')
  ack(@Req() req: { agent: AgentPrincipal }, @Param('id') id: string, @Body() dto: AckDto) {
    return this.agents.ack(req.agent, id, dto.status, dto.result ?? '');
  }

  @Public()
  @Get('update')
  update(@Query('channel') channel?: string) {
    return this.agents.updateChannel(channel);
  }
}
