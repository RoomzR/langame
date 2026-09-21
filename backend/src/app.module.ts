import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { ClubModule } from './modules/club/club.module';
import { SessionModule } from './modules/session/session.module';
import { BookingModule } from './modules/booking/booking.module';
import { PaymentModule } from './modules/payment/payment.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { ProductModule } from './modules/product/product.module';
import { LockerModule } from './modules/locker/locker.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { TournamentModule } from './modules/tournament/tournament.module';
import { NotificationModule } from './modules/notification/notification.module';
import { SocialModule } from './modules/social/social.module';
import { AgentModule } from './modules/agent/agent.module';
import { HealthController } from './health.controller';
import { MetricsController } from './modules/metrics.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../.env', '.env'] }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    PrismaModule,
    AuthModule,
    UserModule,
    ClubModule,
    SessionModule,
    BookingModule,
    PaymentModule,
    RealtimeModule,
    ProductModule,
    LockerModule,
    AnalyticsModule,
    TournamentModule,
    NotificationModule,
    SocialModule,
    AgentModule,
  ],
  controllers: [HealthController, MetricsController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
