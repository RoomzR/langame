import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class MetricsController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @Get('metrics')
  async prometheus() {
    const [sessions, seatsBusy, paymentsPending, clubs] = await Promise.all([
      this.prisma.session.count({ where: { status: { in: ['ACTIVE', 'PAUSED'] } } }),
      this.prisma.seat.count({ where: { status: 'OCCUPIED' } }),
      this.prisma.payment.count({ where: { status: 'PENDING' } }),
      this.prisma.club.count({ where: { isPublished: true } }),
    ]);
    return [
      '# HELP rudemir_sessions_active Active or paused play sessions',
      '# TYPE rudemir_sessions_active gauge',
      `rudemir_sessions_active ${sessions}`,
      '# HELP rudemir_seats_occupied Occupied seats',
      '# TYPE rudemir_seats_occupied gauge',
      `rudemir_seats_occupied ${seatsBusy}`,
      '# HELP rudemir_payments_pending Pending acquiring payments',
      '# TYPE rudemir_payments_pending gauge',
      `rudemir_payments_pending ${paymentsPending}`,
      '# HELP rudemir_clubs_published Published clubs',
      '# TYPE rudemir_clubs_published gauge',
      `rudemir_clubs_published ${clubs}`,
      '',
    ].join('\n');
  }
}
