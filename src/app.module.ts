import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { THROTTLER_CONFIG } from './config/throttler.config';
import { SubscriptionAccessGuard } from './common/guards/subscription-access.guard';
import { subscriptionProvider } from './modules/subscriptions/subscription.provider';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { CourtsModule } from './modules/courts/courts.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { RecurringBookingsModule } from './modules/recurring-bookings/recurring-bookings.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AvailabilityRulesModule } from './modules/availability-rules/availability-rules.module';
import { ExceptionRulesModule } from './modules/exception-rules/exception-rules.module';
import { BusinessUsersModule } from './modules/business-users/business-users.module';
import { DatabaseModule } from './modules/database/database.module';
import { MasterModule } from './modules/master/master.module';
import { MercadoPagoModule } from './modules/mercadopago/mercadopago.module';
import { PlansModule } from './modules/plans/plans.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot(THROTTLER_CONFIG),
    AuthModule,
    UsersModule,
    BusinessesModule,
    BusinessUsersModule,
    CourtsModule,
    BookingsModule,
    RecurringBookingsModule,
    NotificationsModule,
    AvailabilityRulesModule,
    ExceptionRulesModule,
    MasterModule,
    MercadoPagoModule,
    PlansModule,
    SubscriptionsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    ...subscriptionProvider,
    // Va primero: descartar por cuota es más barato que la consulta de
    // suscripción que hace el guard de abajo.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SubscriptionAccessGuard },
  ],
})
export class AppModule {}
