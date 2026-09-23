import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button, Card, Input } from '../../../components';
import type { InteractivePracticeItem, StudentLessonBlock } from '../types/student-player.types';
import { studentPlayerApi } from '../api/student-player.api';

interface PracticeModeViewProps {
  blocks: StudentLessonBlock[];
  enrollmentId: string;
  lessonId: string;
  practiceCompleted: boolean;
  completionPending: boolean;
  onCompletePractice: (answers: Array<{ practiceId: string; answer: string }>) => void;
  onReturnToLearn: () => void;
  onStartTest: () => void;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR');
}

function stageLabel(stage: number): string {
  const stages: Record<number, string> = {
    1: '1-Bosqich: Tanish va tushunish',
    2: '2-Bosqich: Qoidani qo‘llash',
    3: '3-Bosqich: Kontekstda tanlash',
    4: '4-Bosqich: Shaklni mustahkamlash',
    5: '5-Bosqich: Xatoni aniqlash',
    6: '6-Bosqich: Aralash takror',
  };
  return stages[stage] ?? `${stage}-Bosqich`;
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

export function PracticeModeView({
  blocks,
  enrollmentId,
  lessonId,
  practiceCompleted,
  completionPending,
  onCompletePractice,
  onReturnToLearn,
  onStartTest,
}: PracticeModeViewProps) {
  const items = useMemo(() => blocks.flatMap((block) => block.interactivePractice ?? []), [blocks]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<Record<string, { correct: boolean; explanation: string; correctAnswer?: string }>>({});

  const submitPractice = useMutation({
    mutationFn: ({ practiceId, answer }: { practiceId: string; answer: string }) =>
      studentPlayerApi.submitPractice(enrollmentId, lessonId, practiceId, answer),
  });

  const currentItem: InteractivePracticeItem | undefined = items[currentIndex];
  const currentAnswer = currentItem ? answers[currentItem.id] ?? '' : '';
  const currentResult = currentItem ? submitted[currentItem.id] : undefined;
  const isSubmitted = Boolean(currentResult);
  const isCorrect = currentResult?.correct === true;
  const allCorrect = items.length > 0 && items.every((item) => submitted[item.id]?.correct === true);
  const currentItemId = currentItem?.id;
  const currentItemOptions = currentItem?.options;
  const currentItemType = currentItem?.type;

  const currentOptions = useMemo(() => {
    if (!currentItemId) return [];
    const opts = currentItemOptions ?? [];
    if (currentItemType === 'TRUE_FALSE') return opts;
    return shuffleOptions(opts, `practice-${currentItemId}`);
  }, [currentItemId, currentItemOptions, currentItemType]);

  const correctCount = useMemo(() => Object.values(submitted).filter((res) => res.correct).length, [submitted]);

  if (!items.length) {
    return (
      <Card padding="lg" className="my-8 text-center">
        <p className="text-body-md text-text-secondary">Bu dars uchun amaliy mashqlar mavjud emas.</p>
        <div className="mt-4 flex justify-center gap-3">
          <Button intent="secondary" onClick={onReturnToLearn}>← Darsga qaytish</Button>
          <Button onClick={onStartTest}>Yakuniy testga o‘tish ▶</Button>
        </div>
      </Card>
    );
  }

  const handleSubmitCurrent = () => {
    if (!currentItem || !currentAnswer.trim()) return;
    submitPractice.mutate(
      { practiceId: currentItem.id, answer: currentAnswer },
      {
        onSuccess: (result) => {
          setSubmitted((current) => ({ ...current, [currentItem.id]: result }));
        },
      }
    );
  };

  const handleResetCurrent = () => {
    if (!currentItem) return;
    setSubmitted((current) => {
      const next = { ...current };
      delete next[currentItem.id];
      return next;
    });
    setAnswers((current) => ({ ...current, [currentItem.id]: '' }));
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Practice Navigation Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border-decorative bg-surface p-4 shadow-subtle">
        <button
          onClick={onReturnToLearn}
          type="button"
          className="inline-flex items-center gap-1.5 text-button text-action-primary-text hover:underline"
        >
          <span>←</span> Nazariyaga qaytish
        </button>

        <div className="flex items-center gap-3">
          <span className="text-label-md text-text-secondary">
            Mashq <span className="font-bold text-text-primary">{currentIndex + 1}</span> / {items.length}
          </span>
          <div className="h-2 w-28 overflow-hidden rounded-full bg-subtle">
            <div
              className="h-full bg-action-primary-bg transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / items.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Exercise Card */}
      <Card elevation="card" padding="lg" className="border-t-4 border-t-action-primary-bg">
        <div className="flex items-center justify-between gap-2 border-b border-border-decorative pb-3 mb-4">
          <span className="rounded-full bg-subtle px-3 py-1 text-caption font-semibold text-text-secondary">
            {stageLabel(currentItem.stage)}
          </span>
          {isSubmitted && (
            <span className={`text-label-md font-bold ${isCorrect ? 'text-success-text' : 'text-danger-text'}`}>
              {isCorrect ? '✓ Bajarildi' : '✕ Qayta urinib ko‘ring'}
            </span>
          )}
        </div>

        <h3 className="type-heading-3 text-text-primary mb-5">{currentItem.prompt}</h3>

        {/* Input Types */}
        {currentItem.type === 'MISSING_WORD' ? (
          <div className="my-4">
            <label className="block text-label-md mb-2 text-text-secondary">Javobingizni kiriting:</label>
            <Input
              aria-label="Javob"
              disabled={isSubmitted}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [currentItem.id]: e.target.value }))}
              placeholder="Javobni bu yerga yozing..."
              value={currentAnswer}
            />
          </div>
        ) : (
          <div className="my-4 space-y-2.5">
            {currentOptions.map((option) => {
              const isSelected = currentAnswer === option;
              const isOptionCorrect =
                isSubmitted &&
                ((currentResult?.correct && isSelected) ||
                  (currentResult?.correctAnswer && normalize(option) === normalize(currentResult.correctAnswer)));

              let optionStyle = 'border-border-control bg-surface hover:bg-subtle/60';
              if (isSelected && !isSubmitted) {
                optionStyle = 'border-action-primary-bg bg-action-primary-bg/10 font-semibold ring-1 ring-action-primary-bg';
              } else if (isSubmitted) {
                if (isOptionCorrect) {
                  optionStyle = 'border-success-border bg-success-bg text-success-text font-semibold';
                } else if (isSelected && !isCorrect) {
                  optionStyle = 'border-danger-border bg-danger-bg/40 text-danger-text';
                }
              }

              return (
                <button
                  key={option}
                  disabled={isSubmitted}
                  onClick={() => setAnswers((prev) => ({ ...prev, [currentItem.id]: option }))}
                  type="button"
                  className={`flex min-h-target w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-body-md transition-all ${optionStyle}`}
                >
                  <span>{option}</span>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-caption">
                    {isSelected ? '●' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Action button before submission */}
        {!isSubmitted && (
          <div className="mt-6 flex items-center justify-between">
            <Button
              disabled={currentIndex === 0}
              intent="secondary"
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            >
              ← Oldingisi
            </Button>

            <Button
              disabled={!currentAnswer.trim() || submitPractice.isPending}
              loading={submitPractice.isPending}
              onClick={handleSubmitCurrent}
            >
              Javobni tekshirish
            </Button>
          </div>
        )}

        {/* Immediate Feedback Card */}
        {isSubmitted && (
          <div
            className={`mt-6 rounded-lg border p-4 ${
              isCorrect ? 'border-success-border bg-success-bg text-success-text' : 'border-warning-border bg-warning-bg text-warning-text'
            }`}
            role="status"
          >
            <div className="flex items-center gap-2 font-bold text-label-md">
              <span>{isCorrect ? '✓ To‘g‘ri javob!' : '✕ Noto‘g‘ri javob.'}</span>
            </div>
            <p className="mt-1 text-body-sm">{currentResult?.explanation}</p>
            {!isCorrect && currentResult?.correctAnswer && (
              <p className="mt-1 text-body-sm font-semibold">To‘g‘ri javob: {currentResult.correctAnswer}</p>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              {!isCorrect ? (
                <Button intent="secondary" onClick={handleResetCurrent}>
                  Qayta urinish
                </Button>
              ) : (
                <span />
              )}

              {currentIndex < items.length - 1 ? (
                <Button onClick={() => setCurrentIndex((prev) => prev + 1)}>
                  Keyingi mashq →
                </Button>
              ) : <span />}
            </div>
          </div>
        )}
      </Card>

      {/* Bottom Practice Stepper Controls */}
      <div className="flex items-center justify-between px-2">
        <Button
          disabled={currentIndex === 0}
          intent="secondary"
          onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
        >
          ← Oldingi mashq
        </Button>

        <span className="text-caption text-text-muted">
          Bajarildi: {Object.keys(submitted).length} / {items.length}
        </span>

        {currentIndex < items.length - 1 ? (
          <Button
            intent="secondary"
            onClick={() => setCurrentIndex((prev) => Math.min(items.length - 1, prev + 1))}
          >
            Keyingi mashq →
          </Button>
        ) : <span />}
      </div>

      {/* Persistent completion is recorded only after every item is correct. */}
      {(allCorrect || practiceCompleted) && (
        <Card padding="lg" className="border-success-border bg-success-bg/30 text-center my-8">
          <h3 className="type-heading-3 text-success-text mb-2">🎉 Barcha amaliy mashqlar bajarildi!</h3>
          <p className="text-body-md text-text-primary mb-4">
            {practiceCompleted
              ? 'Amaliyot yakunlangani saqlandi.'
              : <>Natijangiz: <strong>{correctCount} / {items.length}</strong> to‘g‘ri javob.</>}
          </p>
          <p className="text-body-sm text-text-secondary mb-6">
            {practiceCompleted
              ? 'Endi mavzu bo‘yicha yakuniy testni boshlashingiz mumkin.'
              : 'Natijani saqlang. Shundan keyin yakuniy test ochiladi.'}
          </p>
          {practiceCompleted ? (
            <Button size="lg" onClick={onStartTest}>Yakuniy testni boshlash ▶</Button>
          ) : (
            <Button
              disabled={completionPending}
              loading={completionPending}
              size="lg"
              onClick={() =>
                onCompletePractice(
                  items.map((item) => ({ practiceId: item.id, answer: answers[item.id] ?? '' })),
                )
              }
            >
              Amaliyotni yakunlash
            </Button>
          )}
        </Card>
      )}
    </div>
  );
}
