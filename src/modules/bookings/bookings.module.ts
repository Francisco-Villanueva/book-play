import { Module } from '@nestjs/common';
import { bookingProvider } from './booking.provider';

@Module({
  providers: [...bookingProvider],
  exports: [...bookingProvider],
})
export class BookingsModule {}
