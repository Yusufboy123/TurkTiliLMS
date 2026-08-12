import { RoleCode } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { StudentProductivityService } from '../../src/modules/student-productivity/student-productivity.service.js';
import type { StudentProductivityRepository } from '../../src/modules/student-productivity/student-productivity.repository.js';
import type { BookmarkRecord, NoteRecord } from '../../src/modules/student-productivity/student-productivity.types.js';

const student = { userId: 'student-1', roles: [RoleCode.STUDENT] } as const;
const lesson: BookmarkRecord = { id: 'bookmark-1', kind: 'LESSON', lessonId: 'lesson-1', vocabularyId: null, title: 'Dars', subtitle: null, courseTitle: 'Kurs', targetUrl: '/app/courses/course-1', createdAt: '2026-08-12T00:00:00.000Z' };

class FakeRepository implements StudentProductivityRepository {
  bookmarks = new Map<string, BookmarkRecord>();
  note: NoteRecord | null = null;
  async createBookmark(userId: string) { const existing = [...this.bookmarks.values()].find((item) => item.lessonId === 'lesson-1' && item.id.startsWith(userId)); if (existing) return existing; const value = { ...lesson, id: `${userId}-bookmark` }; this.bookmarks.set(value.id, value); return value; }
  async findBookmark(userId: string, id: string) { const value = this.bookmarks.get(id); return value?.id.startsWith(userId) ? value : null; }
  async listBookmarks(userId: string) { return [...this.bookmarks.values()].filter((item) => item.id.startsWith(userId)); }
  async deleteBookmark(userId: string, id: string) { const value = await this.findBookmark(userId, id); if (!value) return false; this.bookmarks.delete(id); return true; }
  async hasActiveLessonAccess() { return true; }
  async findVocabularyLesson() { return 'lesson-1'; }
  async getNote() { return this.note; }
  async upsertNote(_userId: string, lessonId: string, input: { content: string }) { this.note = { id: 'note-1', lessonId, content: input.content, createdAt: '2026-08-12T00:00:00.000Z', updatedAt: '2026-08-12T00:01:00.000Z' }; return this.note; }
  async deleteNote() { const existed = Boolean(this.note); this.note = null; return existed; }
  async lessonExists() { return true; }
}

describe('Student productivity service', () => {
  it('creates an idempotent own bookmark and removes it', async () => {
    const repository = new FakeRepository(); const service = new StudentProductivityService(repository);
    const first = await service.createBookmark(student, { lessonId: 'lesson-1' }); const second = await service.createBookmark(student, { lessonId: 'lesson-1' });
    expect(second.id).toBe(first.id); expect(await service.listBookmarks(student)).toHaveLength(1); await service.deleteBookmark(student, first.id); expect(await service.listBookmarks(student)).toHaveLength(0);
  });
  it('keeps notes private and updates the same student/lesson note', async () => {
    const repository = new FakeRepository(); const service = new StudentProductivityService(repository);
    await service.saveNote(student, 'lesson-1', { content: 'Birinchi qayd' }); await service.saveNote(student, 'lesson-1', { content: 'Yangilangan qayd' });
    expect((await service.getNote(student, 'lesson-1'))?.content).toBe('Yangilangan qayd');
    await expect(service.listBookmarks({ userId: 'teacher-1', roles: [RoleCode.TEACHER] })).rejects.toMatchObject({ statusCode: 403 });
  });
});
