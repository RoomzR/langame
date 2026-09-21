import { Module } from '@nestjs/common';
import { ClubService } from './club.service';
import { ClubController } from './club.controller';
import { ExtraClubController } from './extra.controller';
import { ConsoleController } from './console.controller';
import { OpsController } from './ops.controller';
import { SupportController } from './support.controller';
import { GuestService } from './guest.service';
import { OpsService } from './ops.service';
import { ClubGuard } from '../../common/club.guard';
import { NotificationModule } from '../notification/notification.module';
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [NotificationModule, AgentModule],
  controllers: [ClubController, ExtraClubController, ConsoleController, OpsController, SupportController],
  providers: [ClubService, GuestService, OpsService, ClubGuard],
  exports: [ClubService, GuestService],
})
export class ClubModule {}
