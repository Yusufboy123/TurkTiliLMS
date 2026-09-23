import { a2LessonDefinitions } from '../../prisma/a2-content.js';

const expectedPracticeCounts = [33, 33, 33, 33, 31, 33, 33, 31, 31, 31, 31, 31, 31, 31];
const prohibitedExactGrading = /\b(?:MODEL|RUBRIKA|PLACEHOLDER)\s*:|Ochiq javob|Muqobil tabiiy javoblar|Mezon:/iu;

describe('A2 V2 lessons 1-14 content contract', () => {
  it('contains all ordered lessons and a coherent theory/practice pipeline', () => {
    expect(a2LessonDefinitions.map((lesson) => lesson.day)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
    ]);
    expect(new Set(a2LessonDefinitions.map((lesson) => lesson.slug)).size).toBe(14);

    for (const [index, lesson] of a2LessonDefinitions.entries()) {
      expect(lesson.contentBlocks).toHaveLength(2);
      const [theory, practice] = lesson.contentBlocks;
      expect(theory).toMatchObject({ key: 'a2-v2-theory', position: 1, isRequired: false });
      expect(practice).toMatchObject({ key: 'a2-v2-practice', position: 2, isRequired: true });
      expect(theory?.textContent).toContain('Dars maqsadlari');
      expect(theory?.textContent).toContain('Dars xulosasi');
      expect(theory?.textContent).toContain('O‘zingizni tekshiring');
      expect(theory?.textContent).not.toContain('Dars lug‘ati: NEW va REVIEW');
      expect(theory?.textContent).not.toContain('Source ID');
      expect((theory?.textContent?.length ?? 0)).toBeGreaterThan(3_000);
      expect(practice?.practiceItems).toHaveLength(expectedPracticeCounts[index] ?? 0);
    }
  });

  it('keeps every practice item deterministic, unique and student-ready', () => {
    const allIds = new Set<string>();

    for (const lesson of a2LessonDefinitions) {
      const practice = lesson.contentBlocks.flatMap((block) => block.practiceItems ?? []);
      expect(new Set(practice.map((item) => item.prompt)).size).toBe(practice.length);

      for (const item of practice) {
        expect(allIds.has(item.id)).toBe(false);
        allIds.add(item.id);
        expect(item.type).toBe('MULTIPLE_CHOICE');
        expect(item.prompt).toMatch(/^Ko‘rsatma:/u);
        expect(item.prompt).not.toMatch(prohibitedExactGrading);
        expect(item.answer.trim()).not.toBe('');
        expect(item.explanation.trim()).not.toBe('');
        expect(item.options).toHaveLength(4);
        expect(item.options).toContain(item.answer);
        expect(new Set(item.options).size).toBe(item.options?.length);
      }
    }

    expect(allIds.size).toBe(446);
  });

  it('has 350 healthy topic-test questions with exactly one answer key', () => {
    for (const lesson of a2LessonDefinitions) {
      const practicePrompts = new Set(
        lesson.contentBlocks.flatMap((block) => block.practiceItems ?? []).map((item) => item.prompt),
      );
      expect(lesson.questions).toHaveLength(25);
      const identities = lesson.questions.map((question) =>
        JSON.stringify({
          prompt: question.prompt,
          options: [...question.options.map((option) => option.text)].sort(),
        }),
      );
      expect(new Set(identities).size).toBe(lesson.questions.length);

      for (const question of lesson.questions) {
        expect(question.prompt.trim().length).toBeGreaterThan(8);
        expect(question.prompt).not.toMatch(prohibitedExactGrading);
        expect(practicePrompts.has(question.prompt)).toBe(false);
        expect(question.options.filter((option) => option.isCorrect)).toHaveLength(1);
        expect(new Set(question.options.map((option) => option.text)).size).toBe(question.options.length);
        expect(question.options.every((option) => option.text.trim().length > 0)).toBe(true);
      }
    }

    expect(a2LessonDefinitions.reduce((sum, lesson) => sum + lesson.questions.length, 0)).toBe(350);
  });

  it('varies answer positions and preserves the 75 percent mastery contract', () => {
    const positions = a2LessonDefinitions.flatMap((lesson) =>
      lesson.questions.map((question) => question.options.findIndex((option) => option.isCorrect)),
    );
    expect(new Set(positions).size).toBeGreaterThan(1);
    expect(a2LessonDefinitions.every((lesson) => lesson.masteryPassingPercentage === 75)).toBe(true);
  });
});
