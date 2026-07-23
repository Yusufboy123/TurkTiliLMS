import { CourseLevel, CourseStatus } from '@prisma/client';
import { z } from 'zod';
import { catalogSortFields, courseSortFields } from './course.types.js';

const booleanQuerySchema = z.enum(['true', 'false']).transform((value) => value === 'true');

const titleSchema = z
  .string()
  .trim()
  .min(3, 'Kurs nomi kamida 3 ta belgidan iborat bo‘lishi kerak.')
  .max(200, 'Kurs nomi 200 ta belgidan oshmasligi kerak.');

export const courseSlugSchema = z
  .string()
  .trim()
  .min(3, 'Slug kamida 3 ta belgidan iborat bo‘lishi kerak.')
  .max(180, 'Slug 180 ta belgidan oshmasligi kerak.')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/u,
    'Slug faqat kichik lotin harflari, raqamlar va tirelardan iborat bo‘lishi kerak.',
  );

const contentLanguageSchema = z
  .string()
  .trim()
  .min(2)
  .max(35)
  .regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u, 'Kontent tili BCP 47 formatida bo‘lishi kerak.');

const coverImageUrlSchema = z
  .url('Muqova rasmi URL manzili noto‘g‘ri.')
  .max(2_000)
  .refine((value) => value.startsWith('https://') || value.startsWith('http://'), {
    message: 'Muqova rasmi uchun faqat HTTP yoki HTTPS URL ishlatilishi mumkin.',
  });

export const courseIdParamsSchema = z
  .object({
    courseId: z.uuid('Kurs identifikatori noto‘g‘ri.'),
  })
  .strict();

export const courseSlugParamsSchema = z
  .object({
    slug: courseSlugSchema,
  })
  .strict();

export const listCoursesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().min(1).max(100).optional(),
    level: z.nativeEnum(CourseLevel).optional(),
    status: z.nativeEnum(CourseStatus).optional(),
    teacherId: z.uuid('O‘qituvchi identifikatori noto‘g‘ri.').optional(),
    featured: booleanQuerySchema.optional(),
    deleted: z.enum(['exclude', 'include', 'only']).default('exclude'),
    sortBy: z.enum(courseSortFields).default('createdAt'),
    sortDirection: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict();

export const listCatalogCoursesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().min(1).max(100).optional(),
    level: z.nativeEnum(CourseLevel).optional(),
    featured: booleanQuerySchema.optional(),
    sortBy: z.enum(catalogSortFields).default('sortOrder'),
    sortDirection: z.enum(['asc', 'desc']).default('asc'),
  })
  .strict();

export const createCourseSchema = z
  .object({
    title: titleSchema,
    slug: courseSlugSchema.optional(),
    shortDescription: z.string().trim().min(1).max(500).optional(),
    description: z.string().trim().min(1).max(20_000).optional(),
    coverImageUrl: coverImageUrlSchema.optional(),
    contentLanguage: contentLanguageSchema.default('tr'),
    level: z.nativeEnum(CourseLevel).optional(),
    teacherId: z.uuid('O‘qituvchi identifikatori noto‘g‘ri.').optional(),
    estimatedDurationMinutes: z.coerce.number().int().min(1).max(100_000).optional(),
    sortOrder: z.coerce.number().int().min(0).max(1_000_000).default(0),
    isFeatured: z.boolean().default(false),
  })
  .strict();

export const updateCourseSchema = z
  .object({
    title: titleSchema.optional(),
    slug: courseSlugSchema.optional(),
    shortDescription: z.string().trim().min(1).max(500).nullable().optional(),
    description: z.string().trim().min(1).max(20_000).nullable().optional(),
    coverImageUrl: coverImageUrlSchema.nullable().optional(),
    contentLanguage: contentLanguageSchema.optional(),
    level: z.nativeEnum(CourseLevel).nullable().optional(),
    estimatedDurationMinutes: z.coerce.number().int().min(1).max(100_000).nullable().optional(),
    sortOrder: z.coerce.number().int().min(0).max(1_000_000).optional(),
    isFeatured: z.boolean().optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: 'Yangilash uchun kamida bitta maydon yuborilishi kerak.',
  });

export const updateCourseStatusSchema = z
  .object({
    status: z.nativeEnum(CourseStatus),
  })
  .strict();

export const assignCourseTeacherSchema = z
  .object({
    teacherId: z.uuid('O‘qituvchi identifikatori noto‘g‘ri.').nullable(),
  })
  .strict();

export const deleteCourseSchema = z
  .object({
    confirmation: z.literal(true, {
      error: 'Kursni o‘chirish uchun tasdiq talab qilinadi.',
    }),
  })
  .strict();

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
