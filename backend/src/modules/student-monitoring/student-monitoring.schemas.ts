import { z } from 'zod';

export const studentMonitoringIdSchema = z
  .object({ studentId: z.uuid('Talaba identifikatori noto‘g‘ri.') })
  .strict();
export const studentMonitoringQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
    search: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

export type StudentMonitoringQuery = z.infer<typeof studentMonitoringQuerySchema>;
