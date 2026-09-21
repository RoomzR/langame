import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AgentAuthGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header = String(req.headers.authorization ?? '');
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token.startsWith('rda_')) throw new UnauthorizedException({ code: 'AGENT_UNAUTHORIZED' });
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const row = await this.prisma.seatAgent.findFirst({
      where: { tokenHash },
      select: { id: true, clubId: true, seatId: true, hostname: true, agentVersion: true },
    });
    if (!row) throw new UnauthorizedException({ code: 'AGENT_UNAUTHORIZED' });
    req.agent = row;
    return true;
  }
}
