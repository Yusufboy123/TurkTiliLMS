import { a1LessonDefinitions, A1_MASTERY_PASSING_PERCENTAGE } from '../../prisma/a1-content.js';

describe('A1 days 1-12 content contract', () => {
  it('contains all 12 ordered lessons', () => {
    expect(a1LessonDefinitions.map((lesson) => lesson.day)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(new Set(a1LessonDefinitions.map((lesson) => lesson.slug)).size).toBe(12);
    expect(a1LessonDefinitions.every((lesson) => lesson.contentBlocks.length >= 4)).toBe(true);
    expect(a1LessonDefinitions.every((lesson) => lesson.contentBlocks.every((block) => block.blockType === 'TEXT'))).toBe(true);
    expect(a1LessonDefinitions[0]?.contentBlocks.find((block) => block.position === 5)?.practiceItems).toHaveLength(30);
  });

  it('has useful vocabulary and mixed, gradeable quizzes', () => {
    for (const lesson of a1LessonDefinitions) {
      expect(lesson.vocabulary.length).toBeGreaterThanOrEqual(3);
      expect(lesson.questions.length).toBeGreaterThanOrEqual(2);
      expect(new Set(lesson.questions.map((question) => question.prompt)).size).toBe(lesson.questions.length);
      for (const question of lesson.questions) {
        expect(question.options.filter((option) => option.isCorrect)).toHaveLength(1);
      }
    }
  });

  it('varies multiple-choice answer positions and keeps the mastery contract', () => {
    const positions = a1LessonDefinitions.flatMap((lesson) => lesson.questions.filter((question) => question.type === 'MULTIPLE_CHOICE').map((question) => question.options.findIndex((option) => option.isCorrect)));
    expect(new Set(positions).size).toBeGreaterThan(1);
    expect(A1_MASTERY_PASSING_PERCENTAGE).toBe(75);
    expect(a1LessonDefinitions.every((lesson) => lesson.masteryPassingPercentage === 75)).toBe(true);
  });

  it('keeps Day 1 as a substantial readable electronic lesson', () => {
    const text = a1LessonDefinitions[0]?.contentBlocks.map((content) => content.textContent ?? '').join('\n') ?? '';
    expect(text).toContain('29 harfdan');
    expect(text).toContain('A a · B b');
    expect(text).toContain('Qalin unlilar');
    expect(text).toContain('I ı va İ i');
    expect(text).toContain('To‘g‘ri: kız · Xato: kiz');
    expect(text).toContain('Muhim:');
  });
});
