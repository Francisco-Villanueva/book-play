import z from 'zod';

export const CourtSchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  name: z.string(),
  sportType: z.string().optional(),
  surface: z.string().optional(),
  capacity: z.number().int().optional(),
  isIndoor: z.boolean(),
  hasLighting: z.boolean(),
  pricePerHour: z.number().optional(),
  description: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TCourt = z.infer<typeof CourtSchema>;
