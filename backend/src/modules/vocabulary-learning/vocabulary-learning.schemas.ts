import { z } from 'zod';

const uuid = z.string().uuid();
export const vocabularyParamsSchema = z.object({ enrollmentId: uuid, lessonId: uuid });
export const vocabularyStatusSchema = z.object({ status: z.enum(['KNOWN', 'NEEDS_REVIEW']) });
export const vocabularyAnswerSchema = z.object({ vocabularyId: uuid, submittedAnswer: z.string().trim().max(200) });
export const vocabularySubmitSchema = z.object({ answers: z.array(vocabularyAnswerSchema).min(1).max(50) });
export const vocabularyAttemptParamsSchema = vocabularyParamsSchema.extend({ attemptId: uuid });
