import z from 'zod';

export const BookingSchema = z.object({
  id: z.string().uuid(),
  courtId: z.string().uuid(),
  businessId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  guestName: z.string().optional(),
  guestPhone: z.string().optional(),
  guestEmail: z.string().email().optional(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  status: z.enum(['ACTIVE', 'CANCELLED']),
  totalPrice: z.number().optional(),
  notes: z.string().optional(),
  cancelledAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TBooking = z.infer<typeof BookingSchema>;
