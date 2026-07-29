// Estado de un turno fijo (la serie, no sus instancias). Las instancias son
// Bookings normales y siguen usando BookingStatus.
export enum RecurringBookingStatus {
  ACTIVE = 'ACTIVE',
  ENDED = 'ENDED',
}
