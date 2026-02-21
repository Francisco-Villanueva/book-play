import z from 'zod';

export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  userName: z.string(),
  email: z.string().email(),
  password: z.string(),
  phone: z.string().optional(),
  globalRole: z.enum(['MASTER', 'PLAYER']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TUser = z.infer<typeof UserSchema>;
