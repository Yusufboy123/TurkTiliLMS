import { CourseEnrollmentSource, CourseEnrollmentStatus } from '@prisma/client';
import { z } from 'zod';
import { enrollmentSortFields } from './course-enrollment.types.js';

const paginationFields = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
};

function normalizeAliases<
  T extends {
    pageSize?: number | undefined;
    limit?: number | undefined;
    sortDirection?: 'asc' | 'desc' | undefined;
    sortOrder?: 'asc' | 'desc' | undefined;
  },
>(
  query: T,
): Omit<T, 'limit' | 'pageSize' | 'sortOrder' | 'sortDirection'> & {
  pageSize: number;
  sortDirection: 'asc' | 'desc';
} {
  const { limit, pageSize, sortDirection, sortOrder, ...rest } = query;
  return {
    ...rest,
    pageSize: pageSize ?? limit ?? 20,
    sortDirection: sortDirection ?? sortOrder ?? 'desc',
  };
}

export const courseIdParamsSchema = z
  .object({ courseId: z.uuid('Kurs identifikatori noto‘g‘ri.') })
  .strict();

export const enrollmentIdParamsSchema = z
  .object({ enrollmentId: z.uuid('Enrollment identifikatori noto‘g‘ri.') })
  .strict();

export const createSelfEnrollmentSchema = z.object({}).strict();

export const createManagedEnrollmentSchema = z
  .object({
    studentId: z.uuid('Talaba identifikatori noto‘g‘ri.'),
  })
  .strict();

export const updateEnrollmentStatusSchema = z
  .object({
    status: z.nativeEnum(CourseEnrollmentStatus),
  })
  .strict();

export const listOwnEnrollmentsQuerySchema = z
  .object({
    ...paginationFields,
    status: z.nativeEnum(CourseEnrollmentStatus).optional(),
    courseId: z.uuid('Kurs identifikatori noto‘g‘ri.').optional(),
    sortBy: z.enum(enrollmentSortFields).default('enrolledAt'),
    sortDirection: z.enum(['asc', 'desc']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  })
  .strict()
  .refine((query) => !(query.pageSize && query.limit), {
    message: 'pageSize va limit bir vaqtda yuborilmasligi kerak.',
  })
  .refine((query) => !(query.sortDirection && query.sortOrder), {
    message: 'sortDirection va sortOrder bir vaqtda yuborilmasligi kerak.',
  })
  .transform(normalizeAliases);

export const listCourseEnrollmentsQuerySchema = z
  .object({
    ...paginationFields,
    status: z.nativeEnum(CourseEnrollmentStatus).optional(),
    source: z.nativeEnum(CourseEnrollmentSource).optional(),
    studentId: z.uuid('Talaba identifikatori noto‘g‘ri.').optional(),
    search: z.string().trim().min(1).max(100).optional(),
    enrolledFrom: z.coerce.date().optional(),
    enrolledTo: z.coerce.date().optional(),
    sortBy: z.enum(enrollmentSortFields).default('enrolledAt'),
    sortDirection: z.enum(['asc', 'desc']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  })
  .strict()
  .refine((query) => !(query.pageSize && query.limit), {
    message: 'pageSize va limit bir vaqtda yuborilmasligi kerak.',
  })
  .refine((query) => !(query.sortDirection && query.sortOrder), {
    message: 'sortDirection va sortOrder bir vaqtda yuborilmasligi kerak.',
  })
  .refine(
    (query) => !query.enrolledFrom || !query.enrolledTo || query.enrolledFrom <= query.enrolledTo,
    { message: 'Enrollment sana oralig‘i noto‘g‘ri.' },
  )
  .transform(normalizeAliases);

export type OwnEnrollmentQuery = z.infer<typeof listOwnEnrollmentsQuerySchema>;
export type CourseEnrollmentQuery = z.infer<typeof listCourseEnrollmentsQuerySchema>;
