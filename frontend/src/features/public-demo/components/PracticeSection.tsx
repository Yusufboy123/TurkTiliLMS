import { useMemo, useState } from 'react';
import { Button, Card } from '../../../components';
import { publicDemoMessages as messages } from '../../../locales/uz-Latn/public-demo';
import {
  answerPracticeQuestion,
  initialPracticeState,
  isCorrectAnswer,
  nextPracticeQuestion,
} from '../public-demo.engine';
import { practiceQuestions, quickRoundQuestions } from '../data/public-demo.data';

const allPracticeQuestions = [...practiceQuestions, ...quickRoundQuestions];

function optionClasses(selected: boolean, correct: boolean, answered: boolean): string {
  if (!answered) {
    return 'border-border-control bg-surface hover:border-action-primary-bg hover:bg-nav-selected-bg';
  }
  if (selected && correct) return 'border-success-border bg-success-bg text-success-text';
  if (selected) return 'border-danger-border bg-danger-bg text-danger-text';
  if (correct) return 'border-success-border bg-success-bg text-success-text';
  return 'border-border-decorative bg-subtle text-text-muted';
}

export function PracticeSection() {
  const [state, setState] = useState(initialPracticeState);
  const question = allPracticeQuestions[state.index];
  const completed = state.index === allPracticeQuestions.length - 1 && state.answered;
  const selectedIsCorrect = state.selectedAnswer
    ? isCorrectAnswer(question, state.selectedAnswer)
    : false;
  const progress = Math.round(
    ((state.index + (state.answered ? 1 : 0)) / allPracticeQuestions.length) * 100,
  );
  const sectionLabel = useMemo(
    () => (state.index >= practiceQuestions.length ? 'Tezkor raund' : 'Asosiy mashq'),
    [state.index],
  );

  function handleAnswer(answer: string) {
    setState((current) => answerPracticeQuestion(current, question, answer));
  }

  function handleNext() {
    setState((current) => nextPracticeQuestion(current, allPracticeQuestions.length));
  }

  function reset() {
    setState(initialPracticeState());
  }

  return (
    <section
      aria-labelledby="practice-title"
      className="border-y border-border-decorative bg-subtle"
    >
      <div className="mx-auto max-w-marketing px-4 py-16 md:px-6 md:py-20 lg:px-8">
        <div className="max-w-reading">
          <p className="text-label-sm uppercase tracking-[0.16em] text-icon-brand">
            Amaliy mashqlar
          </p>
          <h2 className="type-heading-1 mt-3" id="practice-title">
            Bilimingizni darhol sinab ko‘ring
          </h2>
          <p className="mt-3 text-body-lg text-text-secondary">
            Har bir javobdan keyin aniq fikr-mulohaza oling. Bu natija saqlanmaydi.
          </p>
        </div>

        <Card className="mt-8 overflow-hidden" padding="none">
          <div className="border-b border-border-decorative bg-surface p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 text-label-md">
              <span className="text-icon-brand">{sectionLabel}</span>
              <div className="flex items-center gap-4 text-text-secondary">
                <span>
                  {state.points} {messages.feedback.points}
                </span>
                <span>
                  {state.streak} {messages.feedback.streak}
                </span>
              </div>
            </div>
            <div
              className="mt-4"
              aria-label={`Mashq jarayoni: ${progress}%`}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div className="h-2 overflow-hidden rounded-full bg-subtle">
                <div
                  className="h-full rounded-full bg-action-primary-bg transition-[width] duration-base"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {completed ? (
            <div aria-live="polite" className="p-6 text-center sm:p-10">
              <span
                aria-hidden="true"
                className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-success-bg text-2xl text-success-text"
              >
                ✓
              </span>
              <h3 className="mt-5 text-heading-2">Mashqlar yakunlandi</h3>
              <p className="mx-auto mt-3 max-w-reading text-body-md text-text-secondary">
                Siz {allPracticeQuestions.length} ta savolni ko‘rib chiqdingiz va {state.points}{' '}
                ball to‘pladingiz.
              </p>
              <Button className="mt-6" onClick={reset} intent="secondary">
                {messages.feedback.tryAgain}
              </Button>
            </div>
          ) : (
            <div className="p-6 sm:p-10">
              <div className="flex flex-wrap items-center justify-between gap-3 text-label-sm text-text-muted">
                <span>
                  {state.index + 1} / {allPracticeQuestions.length}-savol
                </span>
                <span className="rounded-full bg-nav-selected-bg px-3 py-1 text-nav-selected-text">
                  {question.kind === 'missing-letter' ? 'Bo‘sh joy' : 'Tanlash'}
                </span>
              </div>
              <h3 className="mt-5 max-w-reading text-heading-2">{question.prompt}</h3>
              <div
                className="mt-6 grid gap-3 sm:grid-cols-2"
                role="group"
                aria-label="Javob variantlari"
              >
                {question.options.map((option) => {
                  const selected = state.selectedAnswer === option;
                  const correct = isCorrectAnswer(question, option);
                  return (
                    <button
                      aria-pressed={selected}
                      className={`min-h-12 rounded-xl border px-4 py-3 text-left text-body-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${optionClasses(selected, correct, state.answered)}`}
                      disabled={state.answered}
                      key={option}
                      onClick={() => handleAnswer(option)}
                      type="button"
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span>{option}</span>
                        {state.answered && correct ? (
                          <span aria-label="To‘g‘ri javob">✓</span>
                        ) : null}
                        {state.answered && selected && !correct ? (
                          <span aria-label="Noto‘g‘ri javob">×</span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>

              {state.answered ? (
                <div
                  aria-live="polite"
                  className={`mt-6 rounded-xl border p-4 ${selectedIsCorrect ? 'border-success-border bg-success-bg text-success-text' : 'border-warning-border bg-warning-bg text-warning-text'}`}
                >
                  <p className="font-semibold">
                    {selectedIsCorrect ? messages.feedback.correct : messages.feedback.incorrect}
                  </p>
                  <p className="mt-1 text-body-sm">{question.explanation}</p>
                </div>
              ) : null}

              {state.answered ? (
                <div className="mt-6 flex justify-end">
                  <Button onClick={handleNext}>{messages.feedback.next}</Button>
                </div>
              ) : null}
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
