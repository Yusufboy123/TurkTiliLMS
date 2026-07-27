import { z } from 'zod';

const uuid = (message: string) => z.uuid(message);

export const enrollmentProgressParamsSchema = z
  .object({
    enrollmentId: uuid('Enrollment identifikatori noto‘g‘ri.'),
  })
  .strict();

export const blockProgressParamsSchema = z
  .object({
    enrollmentId: uuid('Enrollment identifikatori noto‘g‘ri.'),
    blockId: uuid('Dars materiali identifikatori noto‘g‘ri.'),
  })
  .strict();

export const lessonProgressParamsSchema = z
  .object({
    enrollmentId: uuid('Enrollment identifikatori noto‘g‘ri.'),
    lessonId: uuid('Dars identifikatori noto‘g‘ri.'),
  })
  .strict();

export const idempotencyKeyHeaderSchema = z
  .string({
    error: 'Idempotency-Key sarlavhasi talab qilinadi.',
  })
  .min(16, 'Idempotency-Key kamida 16 ta belgidan iborat bo‘lishi kerak.')
  .max(128, 'Idempotency-Key 128 ta belgidan oshmasligi kerak.')
  .regex(
    /^[A-Za-z0-9._:-]+$/,
    'Idempotency-Key faqat lotin harflari, raqamlar va . _ : - belgilarini qabul qiladi.',
  );

export const completionMutationSchema = z
  .object({
    expectedCompletionVersion: z
      .number()
      .int('Completion versiyasi butun son bo‘lishi kerak.')
      .min(0, 'Completion versiyasi manfiy bo‘lmasligi kerak.'),
    curriculumVersion: z
      .number()
      .int('Curriculum versiyasi butun son bo‘lishi kerak.')
      .min(1, 'Curriculum versiyasi 1 dan kichik bo‘lmasligi kerak.'),
  })
  .strict();

export const lastVisitedMutationSchema = z
  .object({
    lessonId: uuid('Dars identifikatori noto‘g‘ri.'),
    curriculumVersion: z
      .number()
      .int('Curriculum versiyasi butun son bo‘lishi kerak.')
      .min(1, 'Curriculum versiyasi 1 dan kichik bo‘lmasligi kerak.'),
  })
  .strict();

export const progressSummaryQuerySchema = z
  .object({
    activeLimit: z.coerce.number().int().min(1).max(10).default(5),
  })
  .strict();

export const completedCoursesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(['completedAt', 'enrolledAt']).default('completedAt'),
    sortDirection: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict();

export type CompletionMutationRequest = z.infer<typeof completionMutationSchema>;
export type LastVisitedMutationRequest = z.infer<typeof lastVisitedMutationSchema>;
