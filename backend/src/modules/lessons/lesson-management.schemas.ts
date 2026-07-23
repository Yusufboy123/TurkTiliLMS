import { LessonStatus, LessonType } from '@prisma/client';
import { z } from 'zod';
import { courseSlugSchema } from '../courses/course.schemas.js';
import { lessonSortFields } from './lesson-management.types.js';

const titleSchema = z.string().trim().min(2).max(200);
const booleanQuery = z.enum(['true', 'false']).transform((value) => value === 'true');

export const courseParamsSchema = z.object({ courseId: z.uuid() }).strict();
export const sectionParamsSchema = z.object({ courseId: z.uuid(), sectionId: z.uuid() }).strict();
export const lessonParamsSchema = z.object({ courseId: z.uuid(), lessonId: z.uuid() }).strict();
export const catalogLessonParamsSchema = z
  .object({ courseSlug: courseSlugSchema, lessonSlug: courseSlugSchema })
  .strict();

export const createSectionSchema = z
  .object({
    title: titleSchema,
    description: z.string().trim().min(1).max(10_000).optional(),
    position: z.coerce.number().int().min(1).max(1_000_000).optional(),
  })
  .strict();

export const updateSectionSchema = z
  .object({
    title: titleSchema.optional(),
    description: z.string().trim().min(1).max(10_000).nullable().optional(),
    isPublished: z.boolean().optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: 'Yangilash uchun kamida bitta maydon yuborilishi kerak.',
  });

export const positionSchema = z.object({
  position: z.coerce.number().int().min(1).max(1_000_000),
});

export const createLessonSchema = z
  .object({
    sectionId: z.uuid(),
    title: titleSchema,
    slug: courseSlugSchema.optional(),
    summary: z.string().trim().min(1).max(2_000).optional(),
    content: z.string().trim().min(1).max(100_000).optional(),
    lessonType: z.nativeEnum(LessonType),
    position: z.coerce.number().int().min(1).max(1_000_000).optional(),
    durationMinutes: z.coerce.number().int().min(1).max(100_000).optional(),
    isPreview: z.boolean().default(false),
    teacherId: z.uuid().optional(),
  })
  .strict();

export const updateLessonSchema = z
  .object({
    title: titleSchema.optional(),
    slug: courseSlugSchema.optional(),
    summary: z.string().trim().min(1).max(2_000).nullable().optional(),
    content: z.string().trim().min(1).max(100_000).nullable().optional(),
    lessonType: z.nativeEnum(LessonType).optional(),
    durationMinutes: z.coerce.number().int().min(1).max(100_000).nullable().optional(),
    isPreview: z.boolean().optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: 'Yangilash uchun kamida bitta maydon yuborilishi kerak.',
  });

export const lessonStatusSchema = z.object({ status: z.nativeEnum(LessonStatus) }).strict();
export const lessonTeacherSchema = z.object({ teacherId: z.uuid().nullable() }).strict();
export const lessonPositionSchema = z
  .object({
    sectionId: z.uuid().optional(),
    position: z.coerce.number().int().min(1).max(1_000_000),
  })
  .strict();

export const lessonListSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    sectionId: z.uuid().optional(),
    status: z.nativeEnum(LessonStatus).optional(),
    lessonType: z.nativeEnum(LessonType).optional(),
    teacherId: z.uuid().optional(),
    isPreview: booleanQuery.optional(),
    search: z.string().trim().min(1).max(100).optional(),
    includeDeleted: booleanQuery.default(false),
    sortBy: z.enum(lessonSortFields).default('position'),
    sortDirection: z.enum(['asc', 'desc']).default('asc'),
  })
  .strict();

export const deleteContentSchema = z
  .object({ confirmation: z.literal(true, { error: 'O‘chirish uchun tasdiq talab qilinadi.' }) })
  .strict();

export type CreateSectionInput = z.infer<typeof createSectionSchema>;
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;
export type CreateLessonInput = z.infer<typeof createLessonSchema>;
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;
