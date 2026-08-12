import { QuestionThreadStatus } from '@prisma/client';
import { z } from 'zod';

const body = z.string().trim().min(1).max(5_000);

export const questionThreadIdSchema = z.object({ threadId: z.uuid() }).strict();
export const questionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  status: z.nativeEnum(QuestionThreadStatus).optional(),
}).strict();
export const createQuestionSchema = z.object({
  courseId: z.uuid(),
  lessonId: z.uuid().optional(),
  subject: z.string().trim().min(1).max(200).optional(),
  body,
}).strict();
export const messageSchema = z.object({ body }).strict();
export const threadStatusSchema = z.object({ status: z.enum(['OPEN', 'CLOSED']) }).strict();

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type QuestionMessageInput = z.infer<typeof messageSchema>;
export type ThreadStatusInput = z.infer<typeof threadStatusSchema>;
