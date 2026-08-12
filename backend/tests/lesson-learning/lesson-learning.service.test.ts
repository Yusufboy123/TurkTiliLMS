import { LessonQuizQuestionType, RoleCode } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/utils/app-error.js';
import type { LessonLearningRepository } from '../../src/modules/lesson-learning/lesson-learning.repository.js';
import { LessonLearningService } from '../../src/modules/lesson-learning/lesson-learning.service.js';
import type { LessonMasteryAccess } from '../../src/modules/lesson-mastery/lesson-mastery.types.js';

const teacher = { userId: 'teacher-1', roles: [RoleCode.TEACHER], permissions: ['lessons.update', 'lessons.read', 'progress.course.read'] };
const student = { userId: 'student-1', roles: [RoleCode.STUDENT], permissions: ['progress.self_read', 'progress.self_complete'] };
const lesson = { id: 'lesson-1', courseId: 'course-1', deletedAt: null, status: 'PUBLISHED', course: { id: 'course-1', teacherId: 'teacher-1', deletedAt: null } };

function setup(overrides: Record<string, unknown> = {}) {
  const repository = {
    findLesson: vi.fn().mockResolvedValue(lesson),
    listVocabulary: vi.fn().mockResolvedValue([]),
    createVocabulary: vi.fn().mockResolvedValue({ id: 'vocab-1' }),
    findVocabulary: vi.fn().mockResolvedValue({ id: 'vocab-1' }),
    updateVocabulary: vi.fn().mockResolvedValue({ id: 'vocab-1' }),
    deleteVocabulary: vi.fn().mockResolvedValue(true),
    listQuestions: vi.fn().mockResolvedValue([]),
    findQuestion: vi.fn().mockResolvedValue(null),
    createQuestion: vi.fn().mockResolvedValue({ id: 'question-1' }),
    updateQuestion: vi.fn(),
    deleteQuestion: vi.fn().mockResolvedValue(true),
    findActiveStudentEnrollment: vi.fn().mockResolvedValue({ id: 'enrollment-1', courseId: 'course-1', studentId: 'student-1' }),
    findStudentQuestions: vi.fn().mockResolvedValue([]),
    createAttempt: vi.fn().mockResolvedValue({ id: 'attempt-1', status: 'IN_PROGRESS' }),
    findAttempt: vi.fn().mockResolvedValue({ id: 'attempt-1', status: 'IN_PROGRESS' }),
    submitAttempt: vi.fn().mockResolvedValue({ id: 'attempt-1', status: 'SUBMITTED', score: 1 }),
    latestResult: vi.fn().mockResolvedValue(null),
    teacherResults: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
  return { repository, service: new LessonLearningService(repository as unknown as LessonLearningRepository) };
}

describe('authenticated lesson learning foundation', () => {
  it('allows an owned teacher to create vocabulary and validates quiz answer keys', async () => {
    const { repository, service } = setup();
    await service.createVocabulary('course-1', 'lesson-1', { turkishWord: 'merhaba', uzbekMeaning: 'salom' }, teacher);
    expect(repository.createVocabulary).toHaveBeenCalledOnce();
    await expect(service.createQuestion('course-1', 'lesson-1', {
      type: LessonQuizQuestionType.MULTIPLE_CHOICE,
      prompt: 'Tanlang',
      points: 1,
      options: [{ text: 'A', isCorrect: true }, { text: 'B', isCorrect: false }],
    }, teacher)).resolves.toMatchObject({ id: 'question-1' });
  });

  it('updates and safely deletes vocabulary in the lesson scope', async () => {
    const { repository, service } = setup();
    await service.updateVocabulary('course-1', 'lesson-1', 'vocab-1', { uzbekMeaning: 'salomlashuv' }, teacher);
    await service.deleteVocabulary('course-1', 'lesson-1', 'vocab-1', teacher);
    expect(repository.updateVocabulary).toHaveBeenCalledOnce();
    expect(repository.deleteVocabulary).toHaveBeenCalledWith('lesson-1', 'vocab-1');
  });

  it('rejects quiz questions without exactly one answer key', async () => {
    const { service } = setup();
    await expect(service.createQuestion('course-1', 'lesson-1', {
      type: LessonQuizQuestionType.MULTIPLE_CHOICE,
      prompt: 'Tanlang',
      points: 1,
      options: [{ text: 'A', isCorrect: true }, { text: 'B', isCorrect: true }],
    }, teacher)).rejects.toMatchObject({ code: 'QUIZ_OPTIONS_INVALID' });
  });

  it('denies a teacher access to another teacher course', async () => {
    const { service } = setup({ findLesson: vi.fn().mockResolvedValue({ ...lesson, course: { ...lesson.course, teacherId: 'other-teacher' } }) });
    await expect(service.listQuestions('course-1', 'lesson-1', teacher)).rejects.toMatchObject({ code: 'COURSE_SCOPE_DENIED' });
  });

  it('returns student quiz options without answer keys and grades through the repository', async () => {
    const { repository, service } = setup({
      findStudentQuestions: vi.fn().mockResolvedValue([{ id: 'q1', type: LessonQuizQuestionType.MULTIPLE_CHOICE, prompt: 'Savol', points: 1, position: 1, options: [{ id: 'o1', text: 'A', position: 1 }, { id: 'o2', text: 'B', position: 2 }] }]),
      listQuestions: vi.fn().mockResolvedValue([{ id: 'q1', type: LessonQuizQuestionType.MULTIPLE_CHOICE, prompt: 'Savol', points: 1, position: 1, options: [{ id: 'o1', text: 'A', isCorrect: true, position: 1 }] }]),
    });
    const quiz = await service.studentQuiz('enrollment-1', 'lesson-1', student);
    expect(quiz.questions[0]?.options[0]).not.toHaveProperty('isCorrect');
    await service.submitAttempt('enrollment-1', 'lesson-1', 'attempt-1', { answers: [{ questionId: 'q1', submittedAnswer: 'o1' }] }, student);
    expect(repository.submitAttempt).toHaveBeenCalledOnce();
  });

  it('starts a student attempt and allows a later retry after submission', async () => {
    const { repository, service } = setup({
      listQuestions: vi.fn().mockResolvedValue([{ id: 'q1', type: LessonQuizQuestionType.TRUE_FALSE, prompt: 'Savol', points: 2, position: 1, options: [{ id: 'o1', text: 'True', isCorrect: true, position: 1 }, { id: 'o2', text: 'False', isCorrect: false, position: 2 }] }]),
      createAttempt: vi.fn()
        .mockResolvedValueOnce({ id: 'attempt-1', status: 'IN_PROGRESS' })
        .mockResolvedValueOnce({ id: 'attempt-2', status: 'IN_PROGRESS' }),
      findAttempt: vi.fn().mockResolvedValue({ id: 'attempt-1', status: 'IN_PROGRESS' }),
    });
    await service.startAttempt('enrollment-1', 'lesson-1', student);
    await service.submitAttempt('enrollment-1', 'lesson-1', 'attempt-1', { answers: [{ questionId: 'q1', submittedAnswer: 'o1' }] }, student);
    await service.startAttempt('enrollment-1', 'lesson-1', student);
    expect(repository.createAttempt).toHaveBeenCalledTimes(2);
  });

  it('persists the authoritative score returned by server grading', async () => {
    const { service } = setup({
      listQuestions: vi.fn().mockResolvedValue([{ id: 'q1', type: LessonQuizQuestionType.TRUE_FALSE, prompt: 'Savol', points: 1, position: 1, options: [{ id: 'o1', text: 'True', isCorrect: true, position: 1 }] }]),
      submitAttempt: vi.fn().mockResolvedValue({ id: 'attempt-1', status: 'SUBMITTED', score: 1, maxScore: 1, percentage: 100, correctCount: 1, incorrectCount: 0, lessonId: 'lesson-1', enrollmentId: 'enrollment-1', startedAt: new Date(), submittedAt: new Date() }),
    });
    await expect(service.submitAttempt('enrollment-1', 'lesson-1', 'attempt-1', { answers: [{ questionId: 'q1', submittedAnswer: 'o1' }] }, student)).resolves.toMatchObject({ score: 1, percentage: 100, status: 'SUBMITTED' });
  });

  it('rejects a submitted attempt from being resubmitted', async () => {
    const submitted = setup({ findAttempt: vi.fn().mockResolvedValue({ id: 'attempt-1', status: 'SUBMITTED' }) });
    await expect(submitted.service.submitAttempt('enrollment-1', 'lesson-1', 'attempt-1', { answers: [{ questionId: 'q1', submittedAnswer: 'o1' }] }, student)).rejects.toMatchObject({ code: 'QUIZ_ATTEMPT_SUBMITTED' });
  });

  it('rejects cross-enrollment quiz access', async () => {
    const crossEnrollment = setup({ findActiveStudentEnrollment: vi.fn().mockResolvedValue(null) });
    await expect(crossEnrollment.service.studentQuiz('other-enrollment', 'lesson-1', student)).rejects.toMatchObject({ code: 'ENROLLMENT_ACCESS_DENIED' });
  });

  it('denies locked lesson vocabulary and quiz access through the shared mastery policy', async () => {
    const { repository } = setup();
    const masteryAccess = {
      canAccessEnrollmentLesson: vi.fn().mockResolvedValue(false),
    };
    const gated = new LessonLearningService(repository as unknown as LessonLearningRepository, masteryAccess as unknown as LessonMasteryAccess);

    await expect(gated.studentVocabulary('enrollment-1', 'lesson-1', student)).rejects.toMatchObject({ code: 'LESSON_MASTERY_LOCKED' });
    await expect(gated.studentQuiz('enrollment-1', 'lesson-1', student)).rejects.toMatchObject({ code: 'LESSON_MASTERY_LOCKED' });
    expect(repository.listVocabulary).not.toHaveBeenCalled();
    expect(repository.findStudentQuestions).not.toHaveBeenCalled();
  });

  it('rejects malformed answer sets before grading', async () => {
    const malformed = setup({
      findAttempt: vi.fn().mockResolvedValue({ id: 'attempt-1', status: 'IN_PROGRESS' }),
      listQuestions: vi.fn().mockResolvedValue([{ id: 'q1', type: LessonQuizQuestionType.TRUE_FALSE, prompt: 'Savol', points: 1, position: 1, options: [] }]),
    });
    await expect(malformed.service.submitAttempt('enrollment-1', 'lesson-1', 'attempt-1', { answers: [] }, student)).rejects.toMatchObject({ code: 'QUIZ_ANSWERS_INVALID' });
  });

  it('returns only the latest safe result fields to teachers', async () => {
    const { service } = setup({
      teacherResults: vi.fn().mockResolvedValue([{ enrollment: { id: 'enrollment-1', student: { id: 'student-1', email: 's@example.test', firstName: 'S', lastName: 'T', displayName: null } }, attempt: { id: 'a', lessonId: 'lesson-1', enrollmentId: 'enrollment-1', startedAt: new Date(), submittedAt: new Date(), score: 2, maxScore: 2, percentage: 100, correctCount: 1, incorrectCount: 0, status: 'SUBMITTED' } }]),
    });
    await expect(service.teacherResults('course-1', 'lesson-1', teacher)).resolves.toMatchObject([{ score: 2, maxScore: 2, percentage: 100 }]);
  });

  it('rejects a non-student actor from student quiz access', async () => {
    const { service } = setup();
    await expect(service.studentQuiz('enrollment-1', 'lesson-1', teacher)).rejects.toBeInstanceOf(AppError);
  });
});
