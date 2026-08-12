import { RoleCode } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { QuestionAnswerService } from '../../src/modules/question-answers/question-answer.service.js';
import type { QuestionAnswerRepository } from '../../src/modules/question-answers/question-answer.repository.js';

const student = { userId: 'student-1', roles: [RoleCode.STUDENT], permissions: [] };
const teacher = { userId: 'teacher-1', roles: [RoleCode.TEACHER], permissions: [] };
const thread = { id: 'thread-1', status: 'OPEN' as const, subject: null, student: { id: 'student-1', name: 'Student' }, teacher: { id: 'teacher-1', name: 'Teacher' }, course: { id: 'course-1', title: 'A1', slug: 'a1' }, lesson: null, latestMessage: null, messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };

function setup(overrides: Partial<QuestionAnswerRepository> = {}) {
  const repository = {
    listForStudent: vi.fn().mockResolvedValue({ items: [thread], total: 1 }),
    listForTeacher: vi.fn().mockResolvedValue({ items: [thread], total: 1 }),
    findForStudent: vi.fn().mockResolvedValue(thread),
    findForTeacher: vi.fn().mockResolvedValue(thread),
    createStudentQuestion: vi.fn().mockResolvedValue(thread),
    addStudentMessage: vi.fn().mockResolvedValue(thread),
    addTeacherMessage: vi.fn().mockResolvedValue(thread),
    setTeacherStatus: vi.fn().mockResolvedValue(thread),
    ...overrides,
  } as unknown as QuestionAnswerRepository;
  return { repository, service: new QuestionAnswerService(repository) };
}

describe('QuestionAnswerService', () => {
  it('creates student questions without accepting a teacher id', async () => {
    const { repository, service } = setup();
    await service.create(student, { courseId: 'course-1', body: 'Savolim' });
    expect(repository.createStudentQuestion).toHaveBeenCalledWith('student-1', { courseId: 'course-1', body: 'Savolim' });
  });

  it('keeps student and teacher scopes separate', async () => {
    const { service } = setup({ findForStudent: vi.fn().mockResolvedValue(null), findForTeacher: vi.fn().mockResolvedValue(null) });
    await expect(service.studentDetail(student, 'other')).rejects.toMatchObject({ code: 'QUESTION_THREAD_NOT_FOUND' });
    await expect(service.teacherDetail(teacher, 'other')).rejects.toMatchObject({ code: 'QUESTION_THREAD_NOT_FOUND' });
  });

  it('allows reply and closure only through the matching role flow', async () => {
    const { service, repository } = setup();
    await service.studentMessage(student, 'thread-1', { body: 'Qo‘shimcha savol' });
    await service.teacherMessage(teacher, 'thread-1', { body: 'Javob' });
    await service.status(teacher, 'thread-1', { status: 'CLOSED' });
    expect(repository.addStudentMessage).toHaveBeenCalled();
    expect(repository.addTeacherMessage).toHaveBeenCalled();
    expect(repository.setTeacherStatus).toHaveBeenCalled();
  });
});
