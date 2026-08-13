import { useMemo, useState } from 'react';
import { Button, Card, FormField, Input } from '../../../components';
import { useStudentLessonQuiz } from '../hooks/use-student-player';
import type { StudentQuizAnswerInput, StudentQuizQuestion } from '../types/student-player.types';

interface TestModeViewProps {
  enrollmentId: string;
  lessonId: string;
  enabled: boolean;
  passingPercentage: number;
  onQuizSubmitted: () => void;
  onReturnToPractice: () => void;
}

function isDailyLimitError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const response = (error as { response?: { data?: { error?: { code?: string } } } }).response;
  return response?.data?.error?.code === 'QUIZ_DAILY_LIMIT_REACHED';
}

function shuffleOptions<T>(options: T[], seed: string): T[] {
  const result = [...options];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.abs((hash ^ (i * 37)) + i * 17) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function QuestionAnswer({
  question,
  value,
  attemptId,
  onChange,
}: {
  question: StudentQuizQuestion;
  value: string;
  attemptId: string | null;
  onChange: (val: string) => void;
}) {
  const displayOptions = useMemo(() => {
    if (question.type === 'TRUE_FALSE') return question.options;
    return shuffleOptions(question.options, `${attemptId ?? 'attempt'}-${question.id}`);
  }, [question.options, question.type, question.id, attemptId]);

  if (question.type === 'MISSING_WORD') {
    return (
      <FormField label="Javobingizni kiriting" required>
        <Input
          onChange={(e) => onChange(e.target.value)}
          placeholder="Bu yerga yozing..."
          required
          value={value}
        />
      </FormField>
    );
  }

  return (
    <fieldset className="grid gap-2.5">
      <legend className="sr-only">Javob varianti</legend>
      {displayOptions.map((option) => {
        const isSelected = value === option.id;
        return (
          <label
            key={option.id}
            className={`flex min-h-target cursor-pointer items-center justify-between rounded-lg border px-4 py-3 text-body-md transition-all ${
              isSelected
                ? 'border-action-primary-bg bg-action-primary-bg/10 font-semibold ring-1 ring-action-primary-bg'
                : 'border-border-control bg-surface hover:bg-subtle/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <input
                checked={isSelected}
                name={`question-${question.id}`}
                onChange={() => onChange(option.id)}
                required
                type="radio"
                className="h-4 w-4 accent-action-primary-bg"
              />
              <span>{option.text}</span>
            </div>
          </label>
        );
      })}
    </fieldset>
  );
}

export function TestModeView({
  enrollmentId,
  lessonId,
  enabled,
  passingPercentage,
  onQuizSubmitted,
  onReturnToPractice,
}: TestModeViewProps) {
  const { quiz, start, submit } = useStudentLessonQuiz(enrollmentId, lessonId, enabled);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [hasConfirmedStart, setHasConfirmedStart] = useState(false);

  const questions = quiz.data?.questions ?? [];

  const handleBegin = () => {
    start.mutate(undefined, {
      onSuccess: (attempt) => {
        setAttemptId(attempt.id);
        setAnswers({});
        setCurrentQuestionIndex(0);
        setHasConfirmedStart(true);
      },
    });
  };

  const handleSubmitAnswers = () => {
    if (!attemptId) return;
    const input: StudentQuizAnswerInput[] = questions.map((question) => ({
      questionId: question.id,
      submittedAnswer: answers[question.id] ?? '',
    }));

    submit.mutate(
      { attemptId, answers: input },
      {
        onSuccess: () => {
          setAttemptId(null);
          setAnswers({});
          onQuizSubmitted();
        },
      }
    );
  };

  if (!enabled) return null;

  if (quiz.isPending) {
    return (
      <Card padding="lg" className="my-8 text-center">
        <p className="text-body-md text-text-secondary" role="status">Yakuniy test savollari yuklanmoqda...</p>
      </Card>
    );
  }

  if (quiz.isError) {
    return (
      <Card padding="lg" className="my-8 border-warning-border bg-warning-bg text-center">
        <p className="text-body-md text-warning-text" role="status">
          Yakuniy test ma’lumotlarini yuklab bo‘lmadi.
        </p>
        <Button className="mt-4" onClick={() => void quiz.refetch()}>Qayta yuklash</Button>
      </Card>
    );
  }

  if (!questions.length) {
    return (
      <Card padding="lg" className="my-8 text-center">
        <p className="text-body-md text-text-secondary">Bu dars uchun yakuniy test savollari mavjud emas.</p>
        <Button className="mt-4" intent="secondary" onClick={onReturnToPractice}>← Amaliyotga qaytish</Button>
      </Card>
    );
  }

  // Handle daily limit error
  if (start.isError) {
    const isDailyLimit = isDailyLimitError(start.error);
    return (
      <Card padding="lg" className="my-8 border-warning-border bg-warning-bg">
        <h3 className="type-heading-3 text-warning-text mb-2">
          {isDailyLimit ? '🔒 Kunlik test chegarasi yetildi' : 'Testni boshlab bo‘lmadi'}
        </h3>
        <p className="text-body-md text-warning-text">
          {isDailyLimit
            ? 'Bugungi yakuniy test topshirish urinishlaringiz (3 marta) tugadi. Dars nazariyasi va amaliy mashqlarni qayta takrorlang va ertaga yana urinib ko‘ring.'
            : 'Testni boshlashda xatolik yuz berdi. Qayta urinib ko‘ring.'}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button intent="secondary" onClick={onReturnToPractice}>Amaliy mashqlarga qaytish</Button>
          {!isDailyLimit && <Button onClick={handleBegin}>Qayta urinib ko‘rish</Button>}
        </div>
      </Card>
    );
  }

  // Pre-test confirmation screen
  if (!hasConfirmedStart && !attemptId) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <Card elevation="card" padding="lg" className="border-t-4 border-t-action-primary-bg">
          <div className="flex items-center gap-3 mb-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-action-primary-bg/10 text-xl font-bold text-action-primary-text">
              📝
            </span>
            <div>
              <h2 className="type-heading-2 text-text-primary">1-Dars Yakuniy Testi</h2>
              <p className="text-body-sm text-text-secondary">Mustaqil baholash imtihoni</p>
            </div>
          </div>

          <div className="my-6 rounded-lg bg-subtle p-5 space-y-3 text-body-md text-text-primary border border-border-decorative">
            <p className="font-semibold text-label-md">Imtihon shartlari va qoidalari:</p>
            <ul className="list-disc space-y-2 pl-5 text-body-sm text-text-secondary">
              <li>Test **{questions.length} ta savol**dan iborat.</li>
              <li>O‘zlashtirish talabi: <strong>kamida {passingPercentage}% ball</strong>.</li>
              <li>Test davomida **dars nazariyasi va amaliy mashqlar ko‘rinmaydi**.</li>
              <li>Javoblaringizni mustaqil belgilang.</li>
              <li>Kuniga ko‘pi bilan **3 marta** test topshirishingiz mumkin.</li>
            </ul>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-border-decorative">
            <Button intent="secondary" onClick={onReturnToPractice}>
              ← Amaliyotga qaytish
            </Button>

            <Button size="lg" disabled={start.isPending} loading={start.isPending} onClick={handleBegin}>
              Testni boshlash ▶
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Active Quiz View
  const activeQuestion = questions[currentQuestionIndex];
  const answeredCount = Object.keys(answers).filter((k) => answers[k]?.trim()).length;
  const isCurrentAnswered = Boolean(answers[activeQuestion.id]?.trim());

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Test Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border-decorative bg-surface p-4 shadow-subtle">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-action-primary-bg animate-pulse" />
          <span className="text-label-md font-bold text-text-primary">Yakuniy Test</span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-body-sm text-text-secondary">
            Savol <strong className="text-text-primary">{currentQuestionIndex + 1}</strong> / {questions.length}
          </span>
          <div className="h-2 w-32 overflow-hidden rounded-full bg-subtle">
            <div
              className="h-full bg-action-primary-bg transition-all duration-300"
              style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Question Card */}
      <Card elevation="card" padding="lg">
        <div className="flex items-center justify-between gap-2 border-b border-border-decorative pb-3 mb-4">
          <span className="text-caption font-semibold text-text-muted">
            {activeQuestion.points} ball
          </span>
          <span className="text-caption text-text-muted">
            Javob berildi: {answeredCount} / {questions.length}
          </span>
        </div>

        <h3 className="type-heading-3 text-text-primary mb-6">
          {currentQuestionIndex + 1}. {activeQuestion.prompt}
        </h3>

        <QuestionAnswer
          attemptId={attemptId}
          onChange={(val) => setAnswers((prev) => ({ ...prev, [activeQuestion.id]: val }))}
          question={activeQuestion}
          value={answers[activeQuestion.id] ?? ''}
        />

        {/* Question Navigation */}
        <div className="mt-8 flex items-center justify-between border-t border-border-decorative pt-4">
          <Button
            disabled={currentQuestionIndex === 0}
            intent="secondary"
            onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
          >
            ← Oldingi savol
          </Button>

          {currentQuestionIndex < questions.length - 1 ? (
            <Button
              disabled={!isCurrentAnswered}
              onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
            >
              Keyingi savol →
            </Button>
          ) : (
            <Button
              disabled={submit.isPending || answeredCount < questions.length}
              loading={submit.isPending}
              onClick={handleSubmitAnswers}
              className="bg-success-text hover:bg-success-text/90"
            >
              Testni topshirish ✓
            </Button>
          )}
        </div>
      </Card>

      {/* Overview Question Grid Navigator */}
      <div className="rounded-xl border border-border-decorative bg-surface p-4 shadow-subtle">
        <p className="text-caption text-text-muted mb-3 font-semibold">Savollar xaritasi:</p>
        <div className="flex flex-wrap gap-2">
          {questions.map((q, idx) => {
            const isAnswered = Boolean(answers[q.id]?.trim());
            const isCurrent = idx === currentQuestionIndex;
            return (
              <button
                key={q.id}
                onClick={() => setCurrentQuestionIndex(idx)}
                type="button"
                className={`flex h-8 w-8 items-center justify-center rounded-md text-caption font-bold transition-all ${
                  isCurrent
                    ? 'ring-2 ring-action-primary-bg bg-action-primary-bg text-white'
                    : isAnswered
                    ? 'bg-success-bg text-success-text border border-success-border'
                    : 'bg-subtle text-text-secondary border border-border-control'
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
