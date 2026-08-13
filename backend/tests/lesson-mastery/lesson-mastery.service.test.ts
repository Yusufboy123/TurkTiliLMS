import { LessonProgressState } from '@prisma/client';
import { decisionFor, type AccessLesson } from '../../src/modules/lesson-mastery/lesson-mastery.service.js';

function lesson(overrides: Partial<AccessLesson> = {}): AccessLesson {
  return {
    id: overrides.id ?? 'lesson-id',
    title: overrides.title ?? 'Dars',
    sectionId: overrides.sectionId ?? 'section-id',
    position: overrides.position ?? 1,
    isPreview: overrides.isPreview ?? false,
    masteryEnabled: overrides.masteryEnabled ?? false,
    masteryPassingPercentage: overrides.masteryPassingPercentage ?? 75,
    quizQuestions: overrides.quizQuestions ?? [],
    progress: overrides.progress ?? [],
    quizAttempts: overrides.quizAttempts ?? [],
    vocabulary: overrides.vocabulary ?? [],
    vocabularyTestAttempts: overrides.vocabularyTestAttempts ?? [],
  };
}

describe('lesson mastery gate', () => {
  it('allows the first lesson and lessons without a configured quiz gate', () => {
    const first = lesson({ id: 'first' });
    expect(decisionFor([first], first.id).allowed).toBe(true);

    const previous = lesson({ id: 'previous', progress: [{ state: LessonProgressState.COMPLETED }] });
    const next = lesson({ id: 'next' });
    expect(decisionFor([previous, next], next.id).allowed).toBe(true);
  });

  it('locks the next lesson until the previous lesson is completed', () => {
    const previous = lesson({ id: 'previous' });
    const next = lesson({ id: 'next' });

    expect(decisionFor([previous, next], next.id)).toMatchObject({
      allowed: false,
      lockReason: 'PREVIOUS_LESSON',
      previousLessonId: 'previous',
    });
  });

  it('requires the configured authoritative quiz percentage before unlocking', () => {
    const previous = lesson({
      id: 'previous',
      masteryEnabled: true,
      masteryPassingPercentage: 80,
      quizQuestions: [{ id: 'question' }],
      progress: [{ state: LessonProgressState.COMPLETED }],
      quizAttempts: [{ percentage: 79 }],
    });
    const next = lesson({ id: 'next' });

    expect(decisionFor([previous, next], next.id)).toMatchObject({
      allowed: false,
      lockReason: 'PREVIOUS_MASTERY',
      requiredPercentage: 80,
      previousPercentage: 79,
    });
    expect(
      decisionFor(
        [
          { ...previous, quizAttempts: [{ percentage: 80 }] },
          next,
        ],
        next.id,
      ).allowed,
    ).toBe(true);
  });

  it('requires vocabulary mastery alongside topic mastery before unlocking', () => {
    const previous = lesson({ id: 'previous', masteryEnabled: true, quizQuestions: [{ id: 'question' }], progress: [{ state: LessonProgressState.COMPLETED }], quizAttempts: [{ percentage: 90 }], vocabulary: [{ id: 'word' }], vocabularyTestAttempts: [{ percentage: 74 }] });
    const next = lesson({ id: 'next' });
    expect(decisionFor([previous, next], next.id).allowed).toBe(false);
    expect(decisionFor([{ ...previous, vocabularyTestAttempts: [{ percentage: 75 }] }, next], next.id).allowed).toBe(true);
  });

  it('allows a passed dual gate while completion state is still being persisted', () => {
    const previous = lesson({
      id: 'previous',
      masteryEnabled: true,
      quizQuestions: [{ id: 'question' }],
      quizAttempts: [{ percentage: 86 }],
      vocabulary: [{ id: 'word' }],
      vocabularyTestAttempts: [{ percentage: 85 }],
    });
    const next = lesson({ id: 'next' });

    expect(decisionFor([previous, next], next.id)).toMatchObject({
      allowed: true,
      lockReason: null,
      previousLessonId: 'previous',
    });
  });
});
