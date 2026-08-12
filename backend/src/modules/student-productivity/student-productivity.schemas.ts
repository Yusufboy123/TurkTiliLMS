import { z } from 'zod';

const uuid = z.uuid();
export const bookmarkInputSchema = z.object({ lessonId: uuid.optional(), vocabularyId: uuid.optional() }).strict().refine((value) => Boolean(value.lessonId) !== Boolean(value.vocabularyId), 'Bitta dars yoki lug‘at yozuvini tanlang.');
export const bookmarkIdSchema = z.object({ bookmarkId: uuid }).strict();
export const lessonIdSchema = z.object({ lessonId: uuid }).strict();
export const noteSchema = z.object({ content: z.string().max(10000, 'Qayd 10 000 belgidan oshmasin.') }).strict();
export type BookmarkInput = z.infer<typeof bookmarkInputSchema>;
export type NoteInput = z.infer<typeof noteSchema>;
