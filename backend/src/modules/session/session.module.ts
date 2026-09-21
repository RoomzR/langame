import { forwardRef, Module } from '@nestjs/common';
import { SessionService } from './session.service';
import { SessionController } from './session.controller';
import { OpsTickerService } from './ops.ticker';
import { RealtimeModule } from '../realtime/realtime.module';
import { BookingModule } from '../booking/booking.module';
import { NotificationModule } from '../notification/notification.module';
import { SocialModule } from '../social/social.module';
import { ClubGuard } from '../../common/club.guard';
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [RealtimeModule, forwardRef(() => BookingModule), NotificationModule, SocialModule, AgentModule],
  controllers: [SessionController],
  providers: [SessionService, OpsTickerService, ClubGuard],
  exports: [SessionService],
})
export class SessionModule {}
