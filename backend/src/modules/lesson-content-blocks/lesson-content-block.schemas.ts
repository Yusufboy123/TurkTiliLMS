import { LessonContentBlockType } from '@prisma/client';
import { z } from 'zod';

const MAX_FILE_SIZE_BYTES = 20n * 1024n * 1024n * 1024n;
const documentMimeTypes = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const imageMimeTypes = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const nullableText = (maximum: number) =>
  z.string().trim().min(1).max(maximum).nullable().optional();

const httpUrlSchema = z
  .string()
  .trim()
  .max(2_048)
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password
    );
  }, 'Faqat xavfsiz HTTP yoki HTTPS manzilidan foydalanish mumkin.');

const nullableHttpUrlSchema = httpUrlSchema.nullable().optional();

const fileNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine(
    (value) =>
      ![...value].some((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint <= 31 || codePoint === 127;
      }),
    'Fayl nomida boshqaruv belgilariga ruxsat berilmaydi.',
  )
  .nullable()
  .optional();

const mimeTypeSchema = z
  .string()
  .trim()
  .min(3)
  .max(160)
  .transform((value) => value.toLowerCase())
  .nullable()
  .optional();

const fileSizeSchema = z
  .union([
    z.number().int().positive().safe(),
    z
      .string()
      .trim()
      .regex(/^[1-9]\d*$/u),
  ])
  .transform((value) => BigInt(value))
  .refine((value) => value <= MAX_FILE_SIZE_BYTES, 'Fayl hajmi 20 GiB dan oshmasligi kerak.')
  .nullable()
  .optional();

const metadataSchema = z
  .record(z.string().min(1).max(100), z.json())
  .refine(
    (value) =>
      !Object.keys(value).some((key) => ['__proto__', 'constructor', 'prototype'].includes(key)),
    'Metadata kalitlaridan biri xavfsiz emas.',
  )
  .refine((value) => JSON.stringify(value).length <= 20_000, 'Metadata hajmi juda katta.')
  .nullable()
  .optional();

const contentShape = {
  title: nullableText(200),
  description: nullableText(10_000),
  isRequired: z.boolean().optional(),
  textContent: nullableText(200_000),
  sourceUrl: nullableHttpUrlSchema,
  externalProvider: nullableText(100),
  fileName: fileNameSchema,
  originalFileName: fileNameSchema,
  fileUrl: nullableHttpUrlSchema,
  mimeType: mimeTypeSchema,
  fileSizeBytes: fileSizeSchema,
  durationSeconds: z.number().int().positive().max(86_400).nullable().optional(),
  thumbnailUrl: nullableHttpUrlSchema,
  metadata: metadataSchema,
};

type ContentDefinition = {
  blockType: LessonContentBlockType;
  textContent?: string | null | undefined;
  sourceUrl?: string | null | undefined;
  fileUrl?: string | null | undefined;
  mimeType?: string | null | undefined;
};

function validateContentDefinition(value: ContentDefinition, context: z.RefinementCtx): void {
  const required = (condition: boolean, path: string, message: string): void => {
    if (!condition) {
      context.addIssue({ code: 'custom', path: [path], message });
    }
  };

  switch (value.blockType) {
    case LessonContentBlockType.TEXT:
      required(
        Boolean(value.textContent),
        'textContent',
        'TEXT blok uchun matn mazmuni talab qilinadi.',
      );
      break;
    case LessonContentBlockType.VIDEO:
      required(
        Boolean(value.fileUrl || value.sourceUrl),
        'fileUrl',
        'VIDEO blok uchun fayl yoki tashqi manba manzili talab qilinadi.',
      );
      if (value.mimeType) {
        required(
          value.mimeType.startsWith('video/'),
          'mimeType',
          'VIDEO blok uchun video MIME turi talab qilinadi.',
        );
      }
      break;
    case LessonContentBlockType.AUDIO:
      required(
        Boolean(value.fileUrl || value.sourceUrl),
        'fileUrl',
        'AUDIO blok uchun fayl yoki tashqi manba manzili talab qilinadi.',
      );
      if (value.mimeType) {
        required(
          value.mimeType.startsWith('audio/'),
          'mimeType',
          'AUDIO blok uchun audio MIME turi talab qilinadi.',
        );
      }
      break;
    case LessonContentBlockType.PDF:
      required(Boolean(value.fileUrl), 'fileUrl', 'PDF blok uchun fayl manzili talab qilinadi.');
      if (value.mimeType) {
        required(
          value.mimeType === 'application/pdf',
          'mimeType',
          'PDF blok uchun application/pdf MIME turi talab qilinadi.',
        );
      }
      break;
    case LessonContentBlockType.DOCUMENT:
      required(
        Boolean(value.fileUrl),
        'fileUrl',
        'DOCUMENT blok uchun fayl manzili talab qilinadi.',
      );
      if (value.mimeType) {
        required(
          documentMimeTypes.has(value.mimeType),
          'mimeType',
          'DOCUMENT blok uchun DOC yoki DOCX MIME turi talab qilinadi.',
        );
      }
      break;
    case LessonContentBlockType.IMAGE:
      required(Boolean(value.fileUrl), 'fileUrl', 'IMAGE blok uchun fayl manzili talab qilinadi.');
      if (value.mimeType) {
        required(
          imageMimeTypes.has(value.mimeType),
          'mimeType',
          'IMAGE blok uchun qo‘llab-quvvatlanadigan rasm MIME turi talab qilinadi.',
        );
      }
      break;
    case LessonContentBlockType.LINK:
      required(
        Boolean(value.sourceUrl),
        'sourceUrl',
        'LINK blok uchun tashqi manba manzili talab qilinadi.',
      );
      break;
    case LessonContentBlockType.DOWNLOAD:
      required(
        Boolean(value.fileUrl),
        'fileUrl',
        'DOWNLOAD blok uchun fayl manzili talab qilinadi.',
      );
      break;
  }
}

export const lessonBlockParentParamsSchema = z
  .object({ courseId: z.uuid(), lessonId: z.uuid() })
  .strict();

export const lessonBlockParamsSchema = z
  .object({
    courseId: z.uuid(),
    lessonId: z.uuid(),
    blockId: z.uuid(),
  })
  .strict();

export const lessonBlockCatalogParamsSchema = z
  .object({
    courseSlug: z
      .string()
      .trim()
      .min(1)
      .max(180)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
    lessonSlug: z
      .string()
      .trim()
      .min(1)
      .max(180)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  })
  .strict();

export const createLessonContentBlockSchema = z
  .object({
    blockType: z.nativeEnum(LessonContentBlockType),
    ...contentShape,
    position: z.number().int().positive().max(1_000_000).optional(),
    isRequired: z.boolean().default(true),
    isVisible: z.boolean().default(true),
  })
  .strict()
  .superRefine(validateContentDefinition);

export const updateLessonContentBlockSchema = z
  .object({
    blockType: z.nativeEnum(LessonContentBlockType).optional(),
    ...contentShape,
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Yangilash uchun kamida bitta maydon yuborilishi kerak.',
  });

export const finalLessonContentBlockSchema = z
  .object({
    blockType: z.nativeEnum(LessonContentBlockType),
    ...contentShape,
  })
  .strict()
  .superRefine(validateContentDefinition);

const booleanQuery = z.enum(['true', 'false']).transform((value) => value === 'true');

export const lessonContentBlockListSchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(50),
    includeDeleted: booleanQuery.default(false),
    blockType: z.nativeEnum(LessonContentBlockType).optional(),
    isVisible: booleanQuery.optional(),
    isRequired: booleanQuery.optional(),
  })
  .strict();

export const lessonContentBlockPositionSchema = z
  .object({ position: z.number().int().positive().max(1_000_000) })
  .strict();

export const restoreLessonContentBlockSchema = z
  .object({ position: z.number().int().positive().max(1_000_000).optional() })
  .strict();

export const lessonContentBlockVisibilitySchema = z.object({ isVisible: z.boolean() }).strict();

export const deleteLessonContentBlockSchema = z
  .object({
    confirmation: z.literal(true, {
      error: 'O‘chirish uchun tasdiq talab qilinadi.',
    }),
  })
  .strict();

export type CreateLessonContentBlockInput = z.infer<typeof createLessonContentBlockSchema>;
export type UpdateLessonContentBlockInput = z.infer<typeof updateLessonContentBlockSchema>;
