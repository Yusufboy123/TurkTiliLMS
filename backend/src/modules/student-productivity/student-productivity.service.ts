import { RoleCode } from '@prisma/client';
import { AppError } from '../../utils/app-error.js';
import type { BookmarkInput, NoteInput } from './student-productivity.schemas.js';
import type { StudentProductivityRepository } from './student-productivity.repository.js';
import type { ProductivityActor } from './student-productivity.types.js';

function assertStudent(actor: ProductivityActor) { if (!actor.roles.includes(RoleCode.STUDENT)) throw new AppError('Bu amal faqat talabalar uchun.', 403, 'ACCESS_DENIED'); }
export class StudentProductivityService {
  constructor(private readonly repository: StudentProductivityRepository) {}
  async listBookmarks(actor: ProductivityActor) { assertStudent(actor); return this.repository.listBookmarks(actor.userId); }
  async createBookmark(actor: ProductivityActor, input: BookmarkInput) { assertStudent(actor); const lessonId = input.lessonId ?? (input.vocabularyId ? await this.repository.findVocabularyLesson(input.vocabularyId) : null); if (!lessonId) throw new AppError('Saqlanadigan yozuv topilmadi.', 404, 'BOOKMARK_TARGET_NOT_FOUND'); if (!(await this.repository.hasActiveLessonAccess(actor.userId, lessonId))) throw new AppError('Bu darsga kirish mumkin emas.', 403, 'LESSON_ACCESS_DENIED'); return this.repository.createBookmark(actor.userId, input); }
  async deleteBookmark(actor: ProductivityActor, bookmarkId: string) { assertStudent(actor); if (!(await this.repository.deleteBookmark(actor.userId, bookmarkId))) throw new AppError('Saqlangan yozuv topilmadi.', 404, 'BOOKMARK_NOT_FOUND'); }
  async getNote(actor: ProductivityActor, lessonId: string) { assertStudent(actor); return this.repository.getNote(actor.userId, lessonId); }
  async saveNote(actor: ProductivityActor, lessonId: string, input: NoteInput) { assertStudent(actor); if (!(await this.repository.lessonExists(lessonId))) throw new AppError('Dars topilmadi.', 404, 'LESSON_NOT_FOUND'); const existing = await this.repository.getNote(actor.userId, lessonId); if (!existing && !(await this.repository.hasActiveLessonAccess(actor.userId, lessonId))) throw new AppError('Bu darsga kirish mumkin emas.', 403, 'LESSON_ACCESS_DENIED'); return this.repository.upsertNote(actor.userId, lessonId, input); }
  async deleteNote(actor: ProductivityActor, lessonId: string) { assertStudent(actor); if (!(await this.repository.deleteNote(actor.userId, lessonId))) throw new AppError('Qayd topilmadi.', 404, 'NOTE_NOT_FOUND'); }
}
