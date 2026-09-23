import { a1LessonDefinitions, A1_MASTERY_PASSING_PERCENTAGE } from '../../prisma/a1-content.js';

const expectedPracticeCounts = [24, 20, 20, 25, 25, 25, 20, 25, 25, 20, 25, 20];
const expectedTopicTestCounts = [20, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12];
const prohibitedSourceLabels = /\b(?:MODEL|RUBRIKA|PLACEHOLDER)\b/i;

describe('A1 V2 lessons 1-12 content contract', () => {
  it('contains all 12 ordered lessons and one coherent theory/practice pipeline', () => {
    expect(a1LessonDefinitions.map((lesson) => lesson.day)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(new Set(a1LessonDefinitions.map((lesson) => lesson.slug)).size).toBe(12);

    for (const [index, lesson] of a1LessonDefinitions.entries()) {
      expect(lesson.contentBlocks).toHaveLength(2);
      const [theory, practice] = lesson.contentBlocks;
      expect(theory).toMatchObject({ key: 'a1-v2-theory', position: 1, isRequired: false });
      expect(practice).toMatchObject({ key: 'a1-v2-practice', position: 2, isRequired: true });
      expect(theory?.textContent).toMatch(/(?:O‘quv|Dars) maqsadlari/);
      expect(theory?.textContent).toMatch(/Qisqa (?:xulosa|yakun)/);
      expect(theory?.textContent).toContain('O‘zingizni tekshiring');
      expect(practice?.practiceItems).toHaveLength(expectedPracticeCounts[index] ?? 0);
    }
  });

  it('keeps every practice item deterministic, unique and student-ready', () => {
    const allIds = new Set<string>();

    for (const lesson of a1LessonDefinitions) {
      const practice = lesson.contentBlocks.flatMap((block) => block.practiceItems ?? []);
      expect(new Set(practice.map((item) => item.prompt)).size).toBe(practice.length);

      for (const item of practice) {
        expect(item.id).toBeTruthy();
        expect(allIds.has(item.id)).toBe(false);
        allIds.add(item.id);
        expect(item.prompt.trim().length).toBeGreaterThan(15);
        expect(item.prompt).not.toMatch(prohibitedSourceLabels);
        expect(item.answer.trim()).not.toBe('');
        expect(item.explanation.trim()).not.toBe('');
        if (item.options) {
          expect(item.options).toContain(item.answer);
          expect(new Set(item.options).size).toBe(item.options.length);
          expect(item.options.every((option) => option.trim().length > 0)).toBe(true);
        }
      }
    }

    expect(allIds.size).toBe(expectedPracticeCounts.reduce((sum, count) => sum + count, 0));
  });

  it('has healthy topic tests with one answer key and no practice copies', () => {
    for (const [index, lesson] of a1LessonDefinitions.entries()) {
      const practicePrompts = new Set(lesson.contentBlocks.flatMap((block) => block.practiceItems ?? []).map((item) => item.prompt));
      expect(lesson.questions).toHaveLength(expectedTopicTestCounts[index] ?? 0);
      expect(new Set(lesson.questions.map((question) => question.prompt)).size).toBe(lesson.questions.length);

      for (const question of lesson.questions) {
        expect(question.prompt.trim().length).toBeGreaterThan(8);
        expect(question.prompt).not.toMatch(prohibitedSourceLabels);
        expect(practicePrompts.has(question.prompt)).toBe(false);
        expect(question.explanation.trim()).not.toBe('');
        expect(question.options.filter((option) => option.isCorrect)).toHaveLength(1);
        expect(new Set(question.options.map((option) => option.text)).size).toBe(question.options.length);
        expect(question.options.every((option) => option.text.trim().length > 0)).toBe(true);
      }
    }
  });

  it('varies answer positions and keeps the 75 percent mastery contract', () => {
    const positions = a1LessonDefinitions.flatMap((lesson) => lesson.questions.map((question) => question.options.findIndex((option) => option.isCorrect)));
    expect(new Set(positions).size).toBeGreaterThan(1);
    expect(A1_MASTERY_PASSING_PERCENTAGE).toBe(75);
    expect(a1LessonDefinitions.every((lesson) => lesson.masteryPassingPercentage === 75)).toBe(true);
  });

  it('keeps Lesson 1 as a substantial readable electronic lesson', () => {
    const text = a1LessonDefinitions[0]?.contentBlocks[0]?.textContent ?? '';
    expect(text).toContain('Turk alifbosida 29 harf bor');
    expect(text).toContain('| A a | a |');
    expect(text).toContain('| Qalin kalın | a, ı, o, u |');
    expect(text).toContain('I İ ı i farqi');
    expect(text).toContain('| ışık | işik |');
    expect(text).toContain('Muhim:');
  });
});
