import { z } from 'zod';

export const adminActivityQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    actorUserId: z.uuid('Actor identifikatori noto‘g‘ri.').optional(),
    action: z.string().trim().min(1).max(100).optional(),
    entityType: z.string().trim().min(1).max(100).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .strict()
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: 'Boshlanish sanasi tugash sanasidan keyin bo‘lishi mumkin emas.',
    path: ['from'],
  });

export type AdminActivityQueryInput = z.infer<typeof adminActivityQuerySchema>;
