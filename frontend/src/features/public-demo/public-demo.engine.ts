import type { AssessmentResult, PracticeState, QuizQuestion } from './types/public-demo.types';

export function isCorrectAnswer(question: QuizQuestion, answer: string): boolean {
  return answer.trim().toLocaleLowerCase('tr-TR') === question.answer.toLocaleLowerCase('tr-TR');
}

export function answerPracticeQuestion(
  state: PracticeState,
  question: QuizQuestion,
  answer: string,
): PracticeState {
  if (state.answered) return state;

  const correct = isCorrectAnswer(question, answer);
  return {
    ...state,
    answered: true,
    selectedAnswer: answer,
    points: state.points + (correct ? 10 : 0),
    streak: correct ? state.streak + 1 : 0,
  };
}

export function nextPracticeQuestion(state: PracticeState, total: number): PracticeState {
  if (!state.answered || state.index >= total - 1) return state;
  return { ...state, index: state.index + 1, answered: false, selectedAnswer: null };
}

export function initialPracticeState(): PracticeState {
  return { index: 0, points: 0, streak: 0, answered: false, selectedAnswer: null };
}

export function calculateAssessmentResult(
  questions: readonly QuizQuestion[],
  answers: readonly (string | null)[],
): AssessmentResult {
  const correct = questions.reduce(
    (count, question, index) =>
      count + (answers[index] && isCorrectAnswer(question, answers[index]) ? 1 : 0),
    0,
  );
  const total = questions.length;
  return {
    total,
    correct,
    incorrect: total - correct,
    percentage: total === 0 ? 0 : Math.round((correct / total) * 100),
  };
}

export function assessmentMessage(percentage: number): string {
  if (percentage >= 90) return 'Ajoyib! Siz Türk alifbosini juda yaxshi o‘zlashtirdingiz.';
  if (percentage >= 70)
    return 'Yaxshi natija! Bir necha harfni yana mashq qilsangiz yanada mustahkam bo‘ladi.';
  return 'Yaxshi boshlanish. Maxsus harflarni yana bir marta ko‘rib chiqing.';
}
