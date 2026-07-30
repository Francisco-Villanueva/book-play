import { Module } from '@nestjs/common';
import { recurringBookingProvider } from './recurring-booking.provider';
import { RecurringBookingsController } from './recurring-bookings.controller';
import { RecurringBookingsService } from './recurring-bookings.service';
import { RecurringBookingsGenerator } from './recurring-bookings.generator';
import { RecurringBookingsCron } from './recurring-bookings.cron';
import { BookingsModule } from '../bookings/bookings.module';
import { BusinessUsersModule } from '../business-users/business-users.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { CourtsModule } from '../courts/courts.module';
import { DatabaseModule } from '../database/database.module';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { subscriptionProvider } from '../subscriptions/subscription.provider';

@Module({
  imports: [
    BookingsModule,
    BusinessUsersModule,
    BusinessesModule,
    CourtsModule,
    DatabaseModule,
    MailModule,
    NotificationsModule,
  ],
  controllers: [RecurringBookingsController],
  providers: [
    RecurringBookingsService,
    RecurringBookingsGenerator,
    RecurringBookingsCron,
    ...recurringBookingProvider,
    ...subscriptionProvider,
  ],
  exports: [RecurringBookingsService, ...recurringBookingProvider],
})
export class RecurringBookingsModule {}
