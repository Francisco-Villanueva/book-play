import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Booking } from './entities/booking.model';

@Module({
  imports: [SequelizeModule.forFeature([Booking])],
  exports: [SequelizeModule],
})
export class BookingsModule {}
