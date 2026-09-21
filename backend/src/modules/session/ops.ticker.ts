import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { SessionService } from './session.service';
import { BookingService } from '../booking/booking.service';

@Injectable()
export class OpsTickerService {
  private readonly log = new Logger(OpsTickerService.name);
  constructor(
    private sessions: SessionService,
    private bookings: BookingService,
  ) {}

  @Interval(5000)
  async tick() {
    if (process.env.DISABLE_TICKER === '1') return;
    try {
      await this.sessions.tickOnce();
      await this.bookings.tickBookings();
    } catch (e) {
      this.log.warn(`tick failed: ${(e as Error).message}`);
    }
  }
}
