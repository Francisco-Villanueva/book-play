import { BOOKING_REPOSITORY } from '../database/constants/repositories.constants';
import { Booking } from './entities/booking.model';

export const bookingProvider = [
  {
    provide: BOOKING_REPOSITORY,
    useValue: Booking,
  },
];
