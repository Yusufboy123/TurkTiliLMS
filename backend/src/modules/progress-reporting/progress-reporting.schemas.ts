import { CourseEnrollmentStatus } from '@prisma/client';
import { z } from 'zod';

const uuid = (message: string) => z.uuid(message);

export const reportingCourseParamsSchema = z
  .object({ courseId: uuid('Kurs identifikatori noto‘g‘ri.') })
  .strict();

export const reportingEnrollmentParamsSchema = z
  .object({ enrollmentId: uuid('Enrollment identifikatori noto‘g‘ri.') })
  .strict();

export const teacherReportingDetailParamsSchema = z
  .object({
    courseId: uuid('Kurs identifikatori noto‘g‘ri.'),
    enrollmentId: uuid('Enrollment identifikatori noto‘g‘ri.'),
  })
  .strict();

const reportingListFields = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(100).optional(),
  enrollmentStatus: z.nativeEnum(CourseEnrollmentStatus).optional(),
  progressState: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']).optional(),
  sortBy: z
    .enum(['lastActivityAt', 'completedAt', 'percentage', 'enrolledAt', 'studentName'])
    .default('lastActivityAt'),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
} as const;

export const teacherProgressReportingQuerySchema = z.object(reportingListFields).strict();

export const adminProgressReportingQuerySchema = z
  .object({
    ...reportingListFields,
    courseId: uuid('Kurs identifikatori noto‘g‘ri.').optional(),
    studentId: uuid('Talaba identifikatori noto‘g‘ri.').optional(),
  })
  .strict();
