import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { ClubGuard } from '../../common/club.guard';
import { NotificationModule } from '../notification/notification.module';
import { SocialModule } from '../social/social.module';
import { ClubModule } from '../club/club.module';

@Module({
  imports: [NotificationModule, SocialModule, ClubModule],
  controllers: [PaymentController],
  providers: [PaymentService, ClubGuard],
  exports: [PaymentService],
})
export class PaymentModule {}
