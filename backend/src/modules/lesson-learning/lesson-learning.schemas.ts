import { LessonQuizQuestionType } from '@prisma/client';
import { z } from 'zod';

const uuid = z.uuid('Identifikator noto‘g‘ri.');
const text = (max: number) => z.string().trim().min(1).max(max);

export const learningParentParamsSchema = z.object({ courseId: uuid, lessonId: uuid }).strict();
export const studentQuizParamsSchema = z.object({ enrollmentId: uuid, lessonId: uuid }).strict();
export const attemptParamsSchema = studentQuizParamsSchema.extend({ attemptId: uuid }).strict();
export const practiceParamsSchema = studentQuizParamsSchema.extend({ practiceId: text(100) }).strict();
export const submitPracticeSchema = z.object({ answer: text(1_000) }).strict();

export const createVocabularySchema = z.object({
  turkishWord: text(200),
  uzbekMeaning: text(500),
  exampleSentence: text(2_000).nullable().optional(),
  position: z.number().int().positive().max(10_000).optional(),
}).strict();

export const updateVocabularySchema = createVocabularySchema.partial().strict().refine((value) => Object.keys(value).length > 0, 'Yangilash uchun maydon yuboring.');
export const vocabularyIdParamsSchema = learningParentParamsSchema.extend({ vocabularyId: uuid }).strict();

const optionSchema = z.object({ text: text(1_000), isCorrect: z.boolean(), position: z.number().int().positive().max(10_000).optional() }).strict();
const questionFields = z.object({
  type: z.nativeEnum(LessonQuizQuestionType),
  prompt: text(2_000),
  explanation: text(2_000).nullable().optional(),
  points: z.number().int().positive().max(1_000),
  position: z.number().int().positive().max(10_000).optional(),
  options: z.array(optionSchema).max(20).optional(),
}).strict();

export const createQuestionSchema = questionFields;
export const updateQuestionSchema = questionFields.partial().strict().refine((value) => Object.keys(value).length > 0, 'Yangilash uchun maydon yuboring.');
export const questionIdParamsSchema = learningParentParamsSchema.extend({ questionId: uuid }).strict();

export const quizAnswerSchema = z.object({ questionId: uuid, submittedAnswer: text(1_000) }).strict();
export const submitQuizSchema = z.object({ answers: z.array(quizAnswerSchema).min(1).max(100) }).strict();

export type CreateVocabularyInput = z.infer<typeof createVocabularySchema>;
export type UpdateVocabularyInput = z.infer<typeof updateVocabularySchema>;
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
export type SubmitQuizInput = z.infer<typeof submitQuizSchema>;
