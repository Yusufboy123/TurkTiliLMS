import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { BookmarkInput, NoteInput } from './student-productivity.schemas.js';
import type { BookmarkRecord, NoteRecord } from './student-productivity.types.js';

const bookmarkSelect = { id: true, lessonId: true, vocabularyId: true, createdAt: true, lesson: { select: { id: true, title: true, courseId: true, course: { select: { title: true } } } }, vocabulary: { select: { id: true, turkishWord: true, uzbekMeaning: true, lesson: { select: { id: true, courseId: true, course: { select: { title: true } } } } } } } satisfies Prisma.StudentBookmarkSelect;
type BookmarkPayload = Prisma.StudentBookmarkGetPayload<{ select: typeof bookmarkSelect }>;
const noteSelect = { id: true, lessonId: true, content: true, createdAt: true, updatedAt: true } satisfies Prisma.StudentLessonNoteSelect;
type NotePayload = Prisma.StudentLessonNoteGetPayload<{ select: typeof noteSelect }>;
function mapNote(row: NotePayload): NoteRecord { return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }; }

function mapBookmark(row: BookmarkPayload): BookmarkRecord {
  const lesson = row.lesson ?? row.vocabulary?.lesson;
  return row.lesson
    ? { id: row.id, kind: 'LESSON', lessonId: row.lessonId, vocabularyId: null, title: row.lesson.title, subtitle: null, courseTitle: row.lesson.course.title, targetUrl: `/app/courses/${row.lesson.courseId}`, createdAt: row.createdAt.toISOString() }
    : { id: row.id, kind: 'VOCABULARY', lessonId: lesson?.id ?? null, vocabularyId: row.vocabularyId, title: row.vocabulary?.turkishWord ?? '', subtitle: row.vocabulary?.uzbekMeaning ?? null, courseTitle: lesson?.course.title ?? '', targetUrl: lesson ? `/app/courses/${lesson.courseId}` : '/', createdAt: row.createdAt.toISOString() };
}

export interface StudentProductivityRepository {
  createBookmark(userId: string, input: BookmarkInput): Promise<BookmarkRecord>;
  findBookmark(userId: string, bookmarkId: string): Promise<BookmarkRecord | null>;
  listBookmarks(userId: string): Promise<BookmarkRecord[]>;
  deleteBookmark(userId: string, bookmarkId: string): Promise<boolean>;
  hasActiveLessonAccess(userId: string, lessonId: string): Promise<boolean>;
  findVocabularyLesson(vocabularyId: string): Promise<string | null>;
  getNote(userId: string, lessonId: string): Promise<NoteRecord | null>;
  upsertNote(userId: string, lessonId: string, input: NoteInput): Promise<NoteRecord>;
  deleteNote(userId: string, lessonId: string): Promise<boolean>;
  lessonExists(lessonId: string): Promise<boolean>;
}

export class PrismaStudentProductivityRepository implements StudentProductivityRepository {
  constructor(private readonly client: PrismaClient = prisma) {}
  private async findBookmarkRow(userId: string, bookmarkId: string) { return this.client.studentBookmark.findFirst({ where: { id: bookmarkId, userId }, select: bookmarkSelect }); }
  async createBookmark(userId: string, input: BookmarkInput) {
    try { const row = await this.client.studentBookmark.create({ data: { userId, lessonId: input.lessonId ?? null, vocabularyId: input.vocabularyId ?? null }, select: bookmarkSelect }); return mapBookmark(row); }
    catch (error: unknown) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') { const target = input.lessonId ? { lessonId: input.lessonId } : { vocabularyId: input.vocabularyId! }; const row = await this.client.studentBookmark.findFirst({ where: { userId, ...target }, select: bookmarkSelect }); if (row) return mapBookmark(row); } throw error; }
  }
  async findBookmark(userId: string, bookmarkId: string) { const row = await this.findBookmarkRow(userId, bookmarkId); return row ? mapBookmark(row) : null; }
  async listBookmarks(userId: string) { const rows = await this.client.studentBookmark.findMany({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100, select: bookmarkSelect }); return rows.map(mapBookmark); }
  async deleteBookmark(userId: string, bookmarkId: string) { const result = await this.client.studentBookmark.deleteMany({ where: { id: bookmarkId, userId } }); return result.count > 0; }
  async hasActiveLessonAccess(userId: string, lessonId: string) { const now = new Date(); return Boolean(await this.client.courseEnrollment.findFirst({ where: { studentId: userId, status: { in: ['ACTIVE', 'COMPLETED'] }, accessStartsAt: { lte: now }, accessExpiresAt: { gt: now }, course: { lessons: { some: { id: lessonId, deletedAt: null } } } }, select: { id: true } })); }
  async findVocabularyLesson(vocabularyId: string) { const row = await this.client.lessonVocabulary.findFirst({ where: { id: vocabularyId, deletedAt: null }, select: { lessonId: true } }); return row?.lessonId ?? null; }
  async getNote(userId: string, lessonId: string) { const row = await this.client.studentLessonNote.findUnique({ where: { userId_lessonId: { userId, lessonId } }, select: noteSelect }); return row ? mapNote(row) : null; }
  async upsertNote(userId: string, lessonId: string, input: NoteInput) { const row = await this.client.studentLessonNote.upsert({ where: { userId_lessonId: { userId, lessonId } }, create: { userId, lessonId, content: input.content }, update: { content: input.content }, select: noteSelect }); return mapNote(row); }
  async deleteNote(userId: string, lessonId: string) { const result = await this.client.studentLessonNote.deleteMany({ where: { userId, lessonId } }); return result.count > 0; }
  async lessonExists(lessonId: string) { return Boolean(await this.client.lesson.findFirst({ where: { id: lessonId, deletedAt: null }, select: { id: true } })); }
}
