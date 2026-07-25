import { Module } from '@nestjs/common';
import { bookingProvider } from './booking.provider';
import { BookingsController } from './bookings.controller';
import { MyBookingsController } from './my-bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingPaymentsService } from './booking-payments.service';
import { BusinessUsersModule } from '../business-users/business-users.module';
import { DatabaseModule } from '../database/database.module';
import { CourtsModule } from '../courts/courts.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { AvailabilityRulesModule } from '../availability-rules/availability-rules.module';
import { ExceptionRulesModule } from '../exception-rules/exception-rules.module';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    BusinessUsersModule,
    DatabaseModule,
    CourtsModule,
    BusinessesModule,
    AvailabilityRulesModule,
    ExceptionRulesModule,
    UsersModule,
    MailModule,
  ],
  controllers: [BookingsController, MyBookingsController],
  providers: [BookingsService, BookingPaymentsService, ...bookingProvider],
  exports: [BookingsService, ...bookingProvider],
})
export class BookingsModule {}
