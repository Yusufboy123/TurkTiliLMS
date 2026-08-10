import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card } from '../../../components';
import { publicDemoMessages as messages } from '../../../locales/uz-Latn/public-demo';
import {
  assessmentMessage,
  calculateAssessmentResult,
  isCorrectAnswer,
} from '../public-demo.engine';
import { finalQuestions } from '../data/public-demo.data';
import type { AssessmentResult } from '../types/public-demo.types';

function resultTone(percentage: number): string {
  if (percentage >= 90) return 'border-success-border bg-success-bg text-success-text';
  if (percentage >= 70) return 'border-info-border bg-info-bg text-info-text';
  return 'border-warning-border bg-warning-bg text-warning-text';
}

export function FinalAssessment() {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<string | null>>(() =>
    finalQuestions.map(() => null),
  );
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const question = finalQuestions[questionIndex];
  const progress = Math.round(
    ((questionIndex + (submitted ? 1 : 0)) / finalQuestions.length) * 100,
  );

  function selectAnswer(answer: string) {
    if (submitted || result) return;
    setSelectedAnswer(answer);
    setAnswers((current) => {
      const next = [...current];
      next[questionIndex] = answer;
      return next;
    });
    setSubmitted(true);
  }

  function nextQuestion() {
    if (!submitted) return;
    if (questionIndex === finalQuestions.length - 1) {
      setResult(calculateAssessmentResult(finalQuestions, answers));
      return;
    }
    setQuestionIndex((current) => current + 1);
    setSelectedAnswer(null);
    setSubmitted(false);
  }

  function retry() {
    setQuestionIndex(0);
    setAnswers(finalQuestions.map(() => null));
    setSelectedAnswer(null);
    setSubmitted(false);
    setResult(null);
    setReviewOpen(false);
  }

  if (result) {
    const incorrectQuestions = finalQuestions.filter(
      (item, index) => !isCorrectAnswer(item, answers[index] ?? ''),
    );
    return (
      <section aria-labelledby="final-title" className="bg-surface" id="yakuniy-test">
        <div className="mx-auto max-w-marketing px-4 py-16 md:px-6 md:py-20 lg:px-8">
          <div className="max-w-reading">
            <p className="text-label-sm uppercase tracking-[0.16em] text-icon-brand">
              {messages.demo.resultEyebrow}
            </p>
            <h2 className="type-heading-1 mt-3" id="final-title">
              Natijangiz tayyor
            </h2>
          </div>
          <ResultCard
            incorrectQuestions={incorrectQuestions}
            result={result}
            reviewOpen={reviewOpen}
            setReviewOpen={setReviewOpen}
            onRetry={retry}
          />
          <ConversionCard />
        </div>
      </section>
    );
  }

  const currentIsCorrect = selectedAnswer ? isCorrectAnswer(question, selectedAnswer) : false;

  return (
    <section aria-labelledby="final-title" className="bg-surface" id="yakuniy-test">
      <div className="mx-auto max-w-marketing px-4 py-16 md:px-6 md:py-20 lg:px-8">
        <div className="max-w-reading">
          <p className="text-label-sm uppercase tracking-[0.16em] text-icon-brand">
            {messages.demo.finalEyebrow}
          </p>
          <h2 className="type-heading-1 mt-3" id="final-title">
            {messages.demo.finalTitle}
          </h2>
          <p className="mt-3 text-body-lg text-text-secondary">{messages.demo.finalDescription}</p>
        </div>

        <Card className="mt-8 overflow-hidden" padding="none">
          <div className="border-b border-border-decorative bg-subtle p-4 sm:p-6">
            <div className="flex items-center justify-between gap-4 text-label-md text-text-secondary">
              <span>
                {questionIndex + 1} / {finalQuestions.length}-savol
              </span>
              <span>{progress}%</span>
            </div>
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-surface"
              role="progressbar"
              aria-label="Yakuniy test jarayoni"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div
                className="h-full rounded-full bg-action-primary-bg transition-[width] duration-base"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <div className="p-6 sm:p-10">
            <h3 className="max-w-reading text-heading-2">{question.prompt}</h3>
            <div
              className="mt-6 grid gap-3 sm:grid-cols-2"
              role="group"
              aria-label="Yakuniy test javoblari"
            >
              {question.options.map((option) => {
                const selected = selectedAnswer === option;
                const correct = isCorrectAnswer(question, option);
                const optionClass = !submitted
                  ? 'border-border-control bg-surface hover:border-action-primary-bg hover:bg-nav-selected-bg'
                  : selected && correct
                    ? 'border-success-border bg-success-bg text-success-text'
                    : selected
                      ? 'border-danger-border bg-danger-bg text-danger-text'
                      : correct
                        ? 'border-success-border bg-success-bg text-success-text'
                        : 'border-border-decorative bg-subtle text-text-muted';
                return (
                  <button
                    aria-pressed={selected}
                    className={`min-h-12 rounded-xl border px-4 py-3 text-left text-body-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${optionClass}`}
                    disabled={submitted}
                    key={option}
                    onClick={() => selectAnswer(option)}
                    type="button"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span>{option}</span>
                      {submitted && correct ? <span aria-label="To‘g‘ri javob">✓</span> : null}
                      {submitted && selected && !correct ? (
                        <span aria-label="Noto‘g‘ri javob">×</span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
            {submitted ? (
              <div
                aria-live="polite"
                className={`mt-6 rounded-xl border p-4 ${currentIsCorrect ? 'border-success-border bg-success-bg text-success-text' : 'border-warning-border bg-warning-bg text-warning-text'}`}
              >
                <p className="font-semibold">
                  {currentIsCorrect ? messages.feedback.correct : messages.feedback.incorrect}
                </p>
                <p className="mt-1 text-body-sm">{question.explanation}</p>
              </div>
            ) : null}
            {submitted ? (
              <div className="mt-6 flex justify-end">
                <Button onClick={nextQuestion}>
                  {questionIndex === finalQuestions.length - 1
                    ? messages.feedback.finish
                    : messages.feedback.next}
                </Button>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </section>
  );
}

interface ResultCardProps {
  incorrectQuestions: typeof finalQuestions;
  result: AssessmentResult;
  reviewOpen: boolean;
  setReviewOpen: (open: boolean) => void;
  onRetry: () => void;
}

function ResultCard({
  incorrectQuestions,
  result,
  reviewOpen,
  setReviewOpen,
  onRetry,
}: ResultCardProps) {
  return (
    <Card className="mt-8" padding="lg">
      <div
        aria-live="polite"
        className={`rounded-2xl border p-6 text-center sm:p-8 ${resultTone(result.percentage)}`}
      >
        <p className="text-label-sm uppercase tracking-[0.14em]">Yakuniy natija</p>
        <p className="mt-3 text-6xl font-bold tracking-tight">{result.percentage}%</p>
        <p className="mx-auto mt-4 max-w-reading text-body-md">
          {assessmentMessage(result.percentage)}
        </p>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <ScoreStat label="Jami savol" value={result.total} />
        <ScoreStat label="To‘g‘ri javob" value={result.correct} />
        <ScoreStat label="Noto‘g‘ri javob" value={result.incorrect} />
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button onClick={onRetry}>{messages.demo.retry}</Button>
        <Button intent="secondary" onClick={() => setReviewOpen(!reviewOpen)}>
          {messages.demo.review}
        </Button>
      </div>
      {reviewOpen ? (
        <div className="mt-6 border-t border-border-decorative pt-6" aria-live="polite">
          {incorrectQuestions.length === 0 ? (
            <p className="text-body-md text-success-text">
              Barcha savollarga to‘g‘ri javob berdingiz.
            </p>
          ) : (
            <div>
              <h3 className="text-heading-4">Qayta ko‘rib chiqish</h3>
              <ul className="mt-3 space-y-3">
                {incorrectQuestions.map((item) => (
                  <li className="rounded-lg bg-subtle p-3 text-body-sm" key={item.id}>
                    <span className="font-semibold">{item.prompt}</span>
                    <span className="mt-1 block text-text-secondary">{item.explanation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}
    </Card>
  );
}

function ScoreStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border-decorative bg-subtle p-4 text-center">
      <p className="text-2xl font-bold text-text-primary">{value}</p>
      <p className="mt-1 text-label-sm text-text-muted">{label}</p>
    </div>
  );
}

export function ConversionCard() {
  return (
    <Card className="mt-8 border-action-primary-bg/20 bg-nav-selected-bg" padding="lg">
      <p className="text-label-sm uppercase tracking-[0.16em] text-icon-brand">Keyingi qadam</p>
      <h2 className="mt-3 text-heading-2">{messages.demo.conversionTitle}</h2>
      <p className="mt-3 max-w-reading text-body-md text-text-secondary">
        {messages.demo.conversionDescription}
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          className="inline-flex min-h-12 items-center justify-center rounded-lg border border-action-primary-border bg-action-primary-bg px-5 py-3 text-button text-action-primary-text no-underline transition-colors hover:bg-action-primary-hover-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          to="/register"
        >
          {messages.demo.conversionRegisterCta}
        </Link>
        <Link
          className="inline-flex min-h-12 items-center justify-center rounded-lg border border-action-secondary-border bg-action-secondary-bg px-5 py-3 text-button text-action-secondary-text no-underline transition-colors hover:bg-action-secondary-hover-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          to="/login"
        >
          {messages.demo.conversionCta}
        </Link>
        <p className="text-body-sm text-text-muted">{messages.demo.conversionNote}</p>
      </div>
    </Card>
  );
}
