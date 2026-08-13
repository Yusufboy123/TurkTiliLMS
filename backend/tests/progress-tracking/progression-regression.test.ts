import { presentLessonProgress } from '../../src/modules/progress-tracking/progress-tracking.presenter.js';
import type { ProgressCapabilitiesDto, ProgressLessonRecord } from '../../src/modules/progress-tracking/progress-tracking.types.js';

describe('A1 Content Migration Progression Regression Safeguard', () => {
  const capabilities: ProgressCapabilitiesDto = {
    canReadProgress: true,
    canAccessCourseContent: true,
    canNavigateCurriculum: true,
    canDownloadPermittedMedia: true,
    canRecordActivity: true,
    canResumeLearning: true,
    canCompleteBlock: true,
    canReopenBlock: true,
    canCompleteLesson: true,
    canReopenLesson: true,
    unavailableReason: null,
  };

  const createLesson1 = (topicScore: number | null, vocabScore: number | null): ProgressLessonRecord => ({
    id: 'lesson-1',
    sectionId: 'section-1',
    title: '1-kun: Türk Alfabesi ve Sesler',
    slug: 'a1-01-turk-alfabesi-va-tovushlar',
    position: 1,
    masteryEnabled: true,
    masteryPassingPercentage: 75,
    masteryHasQuiz: true,
    latestQuizPercentage: topicScore,
    vocabularyHasItems: true,
    latestVocabularyPercentage: vocabScore,
    progress: topicScore !== null && topicScore >= 75 && vocabScore !== null && vocabScore >= 75
      ? { state: 'COMPLETED', firstActivityAt: new Date(), lastActivityAt: new Date(), completedAt: new Date() }
      : null,
    blocks: [
      { id: 'b1', blockType: 'TEXT', title: 'Block 1', position: 1, isRequired: true, progress: { state: 'COMPLETED', completedAt: new Date() } },
    ],
  });

  const lesson2: ProgressLessonRecord = {
    id: 'lesson-2',
    sectionId: 'section-1',
    title: '2-kun: Tanışma ve Kendini Tanıtma',
    slug: 'a1-02-tanishuv-va-ozini-tanishtirish',
    position: 2,
    masteryEnabled: true,
    masteryPassingPercentage: 75,
    masteryHasQuiz: true,
    latestQuizPercentage: null,
    vocabularyHasItems: true,
    latestVocabularyPercentage: null,
    progress: null,
    blocks: [
      { id: 'l2-b1', blockType: 'TEXT', title: 'Lesson 2 Block 1', position: 1, isRequired: true, progress: null },
    ],
  };

  it('Condition 1: Topic pass (83%) + vocabulary missing -> locked with exact state', () => {
    const l1 = createLesson1(83, null);
    const p2 = presentLessonProgress(lesson2, capabilities, l1);
    expect(p2.mastery.locked).toBe(true);
    expect(p2.mastery.lockReason).toBe('PREVIOUS_VOCABULARY');
    expect(p2.mastery.previousTopicPercentage).toBe(83);
    expect(p2.mastery.previousVocabularyPercentage).toBeNull();
    expect(p2.mastery.previousVocabularyRequired).toBe(true);
    expect(p2.capabilities.canAccessLesson).toBe(false);
  });

  it('Condition 2: Topic pass (83%) + vocabulary fail (68%) -> locked with exact state', () => {
    const l1 = createLesson1(83, 68);
    const p2 = presentLessonProgress(lesson2, capabilities, l1);
    expect(p2.mastery.locked).toBe(true);
    expect(p2.mastery.lockReason).toBe('PREVIOUS_VOCABULARY');
    expect(p2.mastery.previousTopicPercentage).toBe(83);
    expect(p2.mastery.previousVocabularyPercentage).toBe(68);
    expect(p2.capabilities.canAccessLesson).toBe(false);
  });

  it('Condition 3: Topic fail (65%) + vocabulary pass (80%) -> locked with exact topic score', () => {
    const l1 = createLesson1(65, 80);
    const p2 = presentLessonProgress(lesson2, capabilities, l1);
    expect(p2.mastery.locked).toBe(true);
    expect(p2.mastery.lockReason).toBe('PREVIOUS_MASTERY');
    expect(p2.mastery.previousTopicPercentage).toBe(65);
    expect(p2.mastery.previousVocabularyPercentage).toBe(80);
    expect(p2.capabilities.canAccessLesson).toBe(false);
  });

  it('Condition 4: Both pass (Topic 83% + Vocab 80%) -> next lesson unlocks', () => {
    const l1 = createLesson1(83, 80);
    const p2 = presentLessonProgress(lesson2, capabilities, l1);
    expect(p2.mastery.locked).toBe(false);
    expect(p2.mastery.lockReason).toBeNull();
    expect(p2.capabilities.canAccessLesson).toBe(true);
  });
});
