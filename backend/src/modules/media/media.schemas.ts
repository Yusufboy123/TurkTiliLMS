import { z } from 'zod';

const uuidSchema = z.uuid('Media fayl identifikatori noto‘g‘ri.');

export const mediaIdParamsSchema = z
  .object({
    id: uuidSchema,
  })
  .strict();

export const deleteMediaSchema = z
  .object({
    confirmation: z.literal(true, {
      error: 'Faylni o‘chirishni tasdiqlash talab qilinadi.',
    }),
  })
  .strict();

export const declaredMediaMetadataSchema = z
  .object({
    originalFileName: z
      .string()
      .trim()
      .min(1, 'Fayl nomi bo‘sh bo‘lishi mumkin emas.')
      .max(255, 'Fayl nomi 255 belgidan oshmasligi kerak.')
      .refine(
        (value) =>
          [...value].every((character) => {
            const code = character.codePointAt(0) ?? 0;
            return code > 31 && code !== 127;
          }),
        'Fayl nomida boshqaruv belgilaridan foydalanib bo‘lmaydi.',
      ),
    mimeType: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, 'Fayl MIME turi ko‘rsatilishi kerak.')
      .max(160, 'Fayl MIME turi juda uzun.'),
  })
  .strict();

export type DeleteMediaInput = z.infer<typeof deleteMediaSchema>;
