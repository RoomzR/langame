import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RequireGlobalRole } from '../../common/decorators';
import { GlobalRoleGuard } from '../../common/roles.guard';

@Controller('support')
@UseGuards(GlobalRoleGuard)
@RequireGlobalRole(UserRole.SUPPORT, UserRole.SUPERADMIN)
export class SupportController {
  constructor(private prisma: PrismaService) {}

  @Get('tickets')
  inbox() {
    return this.prisma.shiftTicket.findMany({
      where: { status: 'OPEN' },
      include: {
        club: { select: { id: true, name: true, city: true } },
        createdBy: { select: { id: true, displayName: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
