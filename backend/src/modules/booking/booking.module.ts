import { forwardRef, Module } from '@nestjs/common';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { RealtimeModule } from '../realtime/realtime.module';
import { SessionModule } from '../session/session.module';
import { NotificationModule } from '../notification/notification.module';
import { ClubGuard } from '../../common/club.guard';
import { ClubModule } from '../club/club.module';

@Module({
  imports: [RealtimeModule, forwardRef(() => SessionModule), NotificationModule, ClubModule],
  controllers: [BookingController],
  providers: [BookingService, ClubGuard],
  exports: [BookingService],
})
export class BookingModule {}
