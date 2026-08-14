import { z } from 'zod';

const uuid = z.string().uuid();
export const finalExamEnrollmentParamsSchema = z.object({ enrollmentId: uuid });
export const finalExamAttemptParamsSchema = finalExamEnrollmentParamsSchema.extend({ attemptId: uuid });
export const finalExamAnswerSchema = z.object({ questionId: uuid, submittedAnswer: z.string().trim().max(500) });
export const finalExamSubmitSchema = z.object({ answers: z.array(finalExamAnswerSchema).min(1).max(100) });
