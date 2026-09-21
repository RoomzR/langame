import { Module } from '@nestjs/common';
import { TournamentController } from './tournament.controller';
import { TournamentService } from './tournament.service';
import { ClubGuard } from '../../common/club.guard';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [TournamentController],
  providers: [TournamentService, ClubGuard],
})
export class TournamentModule {}
