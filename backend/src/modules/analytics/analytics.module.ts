import { Module } from '@nestjs/common';
import { AnalyticsController, NetworkAnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { ClubGuard } from '../../common/club.guard';

@Module({
  controllers: [AnalyticsController, NetworkAnalyticsController],
  providers: [AnalyticsService, ClubGuard],
})
export class AnalyticsModule {}
