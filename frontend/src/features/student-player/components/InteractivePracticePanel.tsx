import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button, Card, Input } from '../../../components';
import type { InteractivePracticeItem, StudentLessonBlock } from '../types/student-player.types';
import { studentPlayerApi } from '../api/student-player.api';

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR');
}

function stageLabel(stage: number): string {
  return `Bosqich ${stage}`;
}

function answerOptions(item: InteractivePracticeItem): string[] {
  if (item.options?.length) return item.options;
  return [];
}

export function InteractivePracticePanel({ blocks, enrollmentId, lessonId, enabled }: { blocks: StudentLessonBlock[]; enrollmentId: string; lessonId: string; enabled: boolean }) {
  const items = useMemo(() => blocks.flatMap((block) => block.interactivePractice ?? []), [blocks]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<Record<string, { correct: boolean; explanation: string; correctAnswer?: string }>>({});
  const submitPractice = useMutation({ mutationFn: ({ practiceId, answer }: { practiceId: string; answer: string }) => studentPlayerApi.submitPractice(enrollmentId, lessonId, practiceId, answer) });

  if (!enabled || !items.length) return null;

  const submit = (item: InteractivePracticeItem) => {
    if (!answers[item.id]?.trim()) return;
    submitPractice.mutate({ practiceId: item.id, answer: answers[item.id] }, { onSuccess: (result) => setSubmitted((current) => ({ ...current, [item.id]: result })) });
  };

  const reset = (item: InteractivePracticeItem) => {
    setSubmitted((current) => { const next = { ...current }; delete next[item.id]; return next; });
    setAnswers((current) => ({ ...current, [item.id]: '' }));
  };

  return (
    <section aria-labelledby="interactive-practice-heading" className="mt-12 max-w-reading">
      <div className="mb-5">
        <p className="text-caption text-action-primary-text">Amaliy mashqlar</p>
        <h2 className="type-heading-2" id="interactive-practice-heading">Qoidani amalda sinab ko‘ring</h2>
        <p className="mt-2 text-body-md text-text-secondary">Har bir javobni tanlang yoki yozing. Xato qilsangiz, izohni o‘qib qayta urinishingiz mumkin.</p>
      </div>
      <div className="grid gap-4">
        {items.map((item, index) => {
          const value = answers[item.id] ?? '';
          const result = submitted[item.id];
          const isSubmitted = Boolean(result);
          const isCorrect = result?.correct === true;
          return (
            <Card key={item.id} elevation="none" padding="lg">
              <p className="text-caption text-text-muted">{index + 1}. {stageLabel(item.stage)}</p>
              <h3 className="type-heading-4 mt-2">{item.prompt}</h3>
              {item.type === 'MISSING_WORD' ? (
                <Input aria-label={`Mashq ${index + 1} javobi`} className="mt-4" disabled={isSubmitted} onChange={(event) => setAnswers((current) => ({ ...current, [item.id]: event.target.value }))} value={value} />
              ) : (
                <fieldset className="mt-4 grid gap-2">
                  <legend className="sr-only">Javobni tanlang</legend>
                  {answerOptions(item).map((option) => (
                    <label className={`flex min-h-target cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-body-md ${isSubmitted && ((result?.correct && value === option) || (result?.correctAnswer && normalize(option) === normalize(result.correctAnswer))) ? 'border-success-border bg-success-bg' : 'border-border-control'}`} key={option}>
                      <input checked={value === option} disabled={isSubmitted} name={`practice-${item.id}`} onChange={() => setAnswers((current) => ({ ...current, [item.id]: option }))} type="radio" />
                      <span>{option}</span>
                    </label>
                  ))}
                </fieldset>
              )}
              {!isSubmitted ? <Button className="mt-4" disabled={!value.trim()} onClick={() => submit(item)}>Javobni tekshirish</Button> : (
                <div className={`mt-4 rounded-md border p-3 ${isCorrect ? 'border-success-border bg-success-bg text-success-text' : 'border-warning-border bg-warning-bg text-warning-text'}`} role="status">
                  <p className="text-label-md">{isCorrect ? '✓ To‘g‘ri!' : '✕ Xato.'}</p>
                  <p className="mt-1 text-body-sm">{result?.explanation}</p>
                  {!isCorrect && result?.correctAnswer ? <p className="mt-1 text-body-sm">To‘g‘ri javob: {result.correctAnswer}</p> : null}
                  <Button className="mt-3" intent="secondary" onClick={() => reset(item)}>Qayta urinish</Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
