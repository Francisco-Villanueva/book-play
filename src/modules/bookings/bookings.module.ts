import { Module } from '@nestjs/common';
import { bookingProvider } from './booking.provider';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BusinessUsersModule } from '../business-users/business-users.module';
import { DatabaseModule } from '../database/database.module';
import { CourtsModule } from '../courts/courts.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { AvailabilityRulesModule } from '../availability-rules/availability-rules.module';
import { ExceptionRulesModule } from '../exception-rules/exception-rules.module';

@Module({
  imports: [
    BusinessUsersModule,
    DatabaseModule,
    CourtsModule,
    BusinessesModule,
    AvailabilityRulesModule,
    ExceptionRulesModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService, ...bookingProvider],
  exports: [BookingsService, ...bookingProvider],
})
export class BookingsModule {}
