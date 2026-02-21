import z from 'zod';

export const BusinessUserSchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(['OWNER', 'ADMIN', 'STAFF']),
  createdAt: z.string().datetime(),
});

export type TBusinessUser = z.infer<typeof BusinessUserSchema>;
