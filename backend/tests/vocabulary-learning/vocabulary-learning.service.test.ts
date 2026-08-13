import { RoleCode } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { VocabularyLearningRepository } from '../../src/modules/vocabulary-learning/vocabulary-learning.repository.js';
import { VocabularyLearningService } from '../../src/modules/vocabulary-learning/vocabulary-learning.service.js';
import { normalizeTurkishAnswer } from '../../src/modules/vocabulary-learning/vocabulary-learning.repository.js';

const student = { userId: 'student-1', roles: [RoleCode.STUDENT] };
const item = { vocabularyId: '00000000-0000-7000-8000-000000000001', vocabulary: { turkishWord: 'kapı', uzbekMeaning: 'eshik' } };

function setup(overrides: Record<string, unknown> = {}) {
  const repository = {
    assertEnrollment: vi.fn().mockResolvedValue({ id: 'enrollment-1' }),
    listLearning: vi.fn().mockResolvedValue([{ id: item.vocabularyId, learnerStatus: 'NEW' }]),
    updateStatus: vi.fn().mockResolvedValue({ vocabularyId: item.vocabularyId, status: 'KNOWN' }),
    latestResult: vi.fn().mockResolvedValue(null),
    countFailedAttemptsToday: vi.fn().mockResolvedValue(0),
    findOpenAttempt: vi.fn().mockResolvedValue(null),
    listTestItems: vi.fn().mockResolvedValue([{ id: item.vocabularyId }]),
    createAttempt: vi.fn().mockResolvedValue({ id: 'attempt-1', lessonId: 'lesson-1', enrollmentId: 'enrollment-1', startedAt: new Date(), submittedAt: null, score: 0, maxScore: 1, percentage: 0, correctCount: 0, incorrectCount: 0, status: 'IN_PROGRESS' }),
    attemptQuestions: vi.fn().mockResolvedValue([item]),
    findAttempt: vi.fn().mockResolvedValue({ id: 'attempt-1' }),
    submitAttempt: vi.fn().mockResolvedValue({ id: 'attempt-1', percentage: 100 }),
    ...overrides,
  };
  return { repository, service: new VocabularyLearningService(repository as unknown as VocabularyLearningRepository) };
}

describe('vocabulary learning and test foundation', () => {
  it('returns only the enrolled student vocabulary and persists known/review status', async () => {
    const { repository, service } = setup();
    await expect(service.learning('enrollment-1', 'lesson-1', student)).resolves.toHaveLength(1);
    await service.status('enrollment-1', 'lesson-1', item.vocabularyId, 'KNOWN', student);
    expect(repository.updateStatus).toHaveBeenCalledWith('student-1', 'lesson-1', item.vocabularyId, 'KNOWN');
  });

  it('starts a typed Uzbek-to-Turkish test without exposing the Turkish answer', async () => {
    const { service } = setup();
    const result = await service.start('enrollment-1', 'lesson-1', student);
    expect(result.questions[0]).toMatchObject({ vocabularyId: item.vocabularyId, prompt: 'eshik', direction: 'UZ_TO_TR_TYPED' });
    expect(result.questions[0]).not.toHaveProperty('turkishWord');
  });

  it('grades Turkish characters case-insensitively but preserves character identity', async () => {
    expect(normalizeTurkishAnswer(' KAPI ')).toBe(normalizeTurkishAnswer('kapı'));
    expect(normalizeTurkishAnswer('kapi')).not.toBe(normalizeTurkishAnswer('kapı'));
    const { repository, service } = setup({ attemptQuestions: vi.fn().mockResolvedValue([item]), submitAttempt: vi.fn().mockResolvedValue({ id: 'attempt-1', percentage: 100 }) });
    await expect(service.submit('enrollment-1', 'lesson-1', 'attempt-1', [{ vocabularyId: item.vocabularyId, submittedAnswer: 'KAPI' }], student)).resolves.toMatchObject({ percentage: 100 });
    expect(repository.submitAttempt).toHaveBeenCalledWith('attempt-1', [{ vocabularyId: item.vocabularyId, turkishWord: 'kapı' }], [{ vocabularyId: item.vocabularyId, submittedAnswer: 'KAPI' }]);
  });

  it('enforces a separate three-failed-attempt vocabulary limit', async () => {
    const { service } = setup({ countFailedAttemptsToday: vi.fn().mockResolvedValue(3) });
    await expect(service.start('enrollment-1', 'lesson-1', student)).rejects.toMatchObject({ code: 'VOCABULARY_DAILY_LIMIT_REACHED' });
  });
});
