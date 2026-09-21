import { Module } from '@nestjs/common';
import { LockerService } from './locker.service';
import { LockerController } from './locker.controller';
import { ClubGuard } from '../../common/club.guard';

@Module({
  controllers: [LockerController],
  providers: [LockerService, ClubGuard],
})
export class LockerModule {}
