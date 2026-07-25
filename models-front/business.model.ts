import z from 'zod';

export const BusinessSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  timezone: z.string(),
  defaultSlotDuration: z.number().int(),
  defaultPricePerSlot: z.number().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TBusiness = z.infer<typeof BusinessSchema>;
