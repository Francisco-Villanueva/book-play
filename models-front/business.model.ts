import z from 'zod';

export const BusinessSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  timezone: z.string(),
  slotDuration: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TBusiness = z.infer<typeof BusinessSchema>;
