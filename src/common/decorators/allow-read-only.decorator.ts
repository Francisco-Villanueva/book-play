import { SetMetadata } from '@nestjs/common';

export const ALLOW_READ_ONLY_KEY = 'allowWhenReadOnly';

// Marks a mutating route as still permitted once the business goes read-only.
// The list is deliberately short and every addition is a product decision:
// cancelling bookings (so nobody who already reserved is stranded), recording
// the on-site payment of those bookings, paying to get out of the lock, and
// deleting the business on the owner's request.
export const AllowWhenReadOnly = () => SetMetadata(ALLOW_READ_ONLY_KEY, true);
