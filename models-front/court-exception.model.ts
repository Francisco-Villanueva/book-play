import z from 'zod';

export const CourtExceptionSchema = z.object({
  id: z.string().uuid(),
  courtId: z.string().uuid(),
  exceptionRuleId: z.string().uuid(),
  createdAt: z.string().datetime(),
});

export type TCourtException = z.infer<typeof CourtExceptionSchema>;
