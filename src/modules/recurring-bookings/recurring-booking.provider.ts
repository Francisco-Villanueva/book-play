import { RECURRING_BOOKING_REPOSITORY } from '../database/constants/repositories.constants';
import { RecurringBooking } from './entities/recurring-booking.model';

export const recurringBookingProvider = [
  {
    provide: RECURRING_BOOKING_REPOSITORY,
    useValue: RecurringBooking,
  },
];
