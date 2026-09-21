import { Module } from '@nestjs/common';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';
import { ClubGuard } from '../../common/club.guard';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [SocialController],
  providers: [SocialService, ClubGuard],
  exports: [SocialService],
})
export class SocialModule {}
