import z from 'zod';

export const ExceptionRuleSchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  date: z.string(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  isAvailable: z.boolean(),
  reason: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TExceptionRule = z.infer<typeof ExceptionRuleSchema>;
