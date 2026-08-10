import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import PublicLandingPage from '../src/features/public-demo/pages/PublicLandingPage';
import TurkAlphabetDemoPage from '../src/features/public-demo/pages/TurkAlphabetDemoPage';
import {
  answerPracticeQuestion,
  assessmentMessage,
  calculateAssessmentResult,
  initialPracticeState,
} from '../src/features/public-demo/public-demo.engine';
import {
  finalQuestions,
  practiceQuestions,
} from '../src/features/public-demo/data/public-demo.data';

function renderPublicRoute(path: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<PublicLandingPage />} path="/" />
        <Route element={<TurkAlphabetDemoPage />} path="/demo/turk-alfabesi" />
      </Routes>
    </MemoryRouter>,
  );
}

describe('public landing and free demo lesson', () => {
  it('renders the landing page and both primary conversion destinations', () => {
    const markup = renderPublicRoute('/');

    expect(markup).toContain('Turk tilini A1 dan C2 gacha tizimli va interaktiv o‘rganing');
    expect(markup).toContain('href="/demo/turk-alfabesi"');
    expect(markup).toContain('href="/login"');
    expect(markup).toContain('A1');
    expect(markup).toContain('C2');
  });

  it('keeps the demo route public and renders the video and complete alphabet', () => {
    const markup = renderPublicRoute('/demo/turk-alfabesi');

    expect(markup).toContain('Türk Alfabesi');
    expect(markup).toContain('youtube-nocookie.com/embed/I0XRfWR51d4');
    expect(markup).toContain('title="Türk Alfabesi video darsi"');
    expect(markup).toContain('Ç');
    expect(markup).toContain('Ğ');
    expect(markup).toContain('İ');
    expect(markup).toContain('Q, W va X');
    expect(markup).not.toContain('/register');
  });
});

describe('local demo practice and assessment engine', () => {
  it('gives immediate correct feedback points and streak progress', () => {
    const state = answerPracticeQuestion(initialPracticeState(), practiceQuestions[0], 'Ş');

    expect(state).toMatchObject({ answered: true, points: 10, streak: 1, selectedAnswer: 'Ş' });
  });

  it('resets the streak for an incorrect answer and prevents double submission', () => {
    const first = answerPracticeQuestion(
      { ...initialPracticeState(), streak: 2 },
      practiceQuestions[0],
      'Q',
    );
    const second = answerPracticeQuestion(first, practiceQuestions[0], 'Ş');

    expect(first).toMatchObject({ answered: true, points: 0, streak: 0, selectedAnswer: 'Q' });
    expect(second).toEqual(first);
  });

  it('calculates final score, percentage, correct and incorrect answers', () => {
    const answers = finalQuestions.map((question, index) =>
      index < 7 ? question.answer : 'wrong',
    );
    expect(calculateAssessmentResult(finalQuestions, answers)).toEqual({
      total: 10,
      correct: 7,
      incorrect: 3,
      percentage: 70,
    });
    expect(assessmentMessage(95)).toContain('juda yaxshi');
    expect(assessmentMessage(70)).toContain('Yaxshi natija');
    expect(assessmentMessage(40)).toContain('Yaxshi boshlanish');
  });
});
