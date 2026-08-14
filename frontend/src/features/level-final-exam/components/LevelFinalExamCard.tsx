import { useState } from 'react';
import { Badge, Button, Card, Input } from '../../../components';
import { useLevelFinalExam } from '../hooks/use-level-final-exam';
import type { FinalExamQuestion, FinalExamResult } from '../types/level-final-exam.types';

function Result({ result, passing }: { result: FinalExamResult; passing: number }) {
  const passed = result.percentage >= passing;
  return <div className={`rounded-xl border p-4 ${passed ? 'border-success-border bg-success-bg' : 'border-warning-border bg-warning-bg'}`} role="status">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="type-heading-3">Natija</h3><Badge intent={passed ? 'success' : 'warning'}>{passed ? 'O‘tdi' : 'Yiqildi'}</Badge></div>
    <p className="mt-2 text-body-md">{result.percentage}% · {result.correctCount}/{result.correctCount + result.incorrectCount} to‘g‘ri</p>
    <p className="mt-1 text-body-sm text-text-secondary">O‘tish talabi: {passing}%</p>
  </div>;
}

export function LevelFinalExamCard({ enrollmentId }: { enrollmentId: string }) {
  const { status, start, submit } = useLevelFinalExam(enrollmentId);
  const [attempt, setAttempt] = useState<{ id: string; questions: FinalExamQuestion[] } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<FinalExamResult | null>(null);
  const [showLatest, setShowLatest] = useState(true);
  if (status.isPending) return <Card><p className="text-body-sm text-text-secondary">Yakuniy imtihon yuklanmoqda…</p></Card>;
  if (status.isError || !status.data) return <Card role="alert"><p className="text-body-sm text-danger-text">Yakuniy imtihonni yuklab bo‘lmadi.</p></Card>;
  const data = status.data;
  if (!data.exam) return <Card><h2 className="type-heading-3">Level yakuniy imtihoni</h2><p className="mt-2 text-body-sm text-text-secondary">Imtihon hali tayyor emas.</p></Card>;
  const visibleResult = result ?? (showLatest ? data.latestResult : null);
  if (visibleResult) return <Card><Result result={visibleResult} passing={data.exam.passingPercentage} /><Button className="mt-4" intent="secondary" onClick={() => { setResult(null); setShowLatest(false); setAttempt(null); setAnswers({}); }}>Yangi urinish</Button></Card>;
  if (attempt) return <Card>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="type-heading-3">{data.exam.title}</h2><Badge intent="info">{attempt.questions.length} savol</Badge></div>
    <div className="mt-5 grid gap-5">
      {attempt.questions.map((question, index) => <fieldset className="rounded-xl border border-border-decorative p-4" key={question.id}>
        <legend className="px-1 text-label-sm">{index + 1}. {question.prompt}</legend>
        {question.type === 'MISSING_WORD' ? <Input className="mt-3" aria-label={`Savol ${index + 1} javobi`} value={answers[question.id] ?? ''} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} /> : <div className="mt-3 grid gap-2">{question.options.map((option) => <label className="flex cursor-pointer items-start gap-2 text-body-sm" key={option.id}><input type="radio" name={question.id} value={option.id} checked={answers[question.id] === option.id} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} /> <span>{option.text}</span></label>)}</div>}
      </fieldset>)}
    </div>
    <Button className="mt-5" loading={submit.isPending} onClick={() => void submit.mutateAsync({ attemptId: attempt.id, answers: attempt.questions.map((question) => ({ questionId: question.id, submittedAnswer: answers[question.id] ?? '' })) }).then(setResult)}>Javoblarni yuborish</Button>
  </Card>;
  return <Card>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-label-sm text-action-primary-text">Bosqich yakuni</p><h2 className="type-heading-3 mt-1">{data.exam.title}</h2></div><Badge intent={data.eligible ? 'success' : 'neutral'}>{data.lessonsMastered}/{data.lessonsTotal} dars</Badge></div>
    {data.eligible ? <><p className="mt-3 text-body-md">Barcha darslarni o‘zlashtirdingiz. Imtihondan kamida {data.exam.passingPercentage}% oling.</p><Button className="mt-5" loading={start.isPending} onClick={() => void start.mutateAsync().then((value) => setAttempt({ id: value.attempt.id, questions: value.questions }))}>Yakuniy imtihonni boshlash</Button></> : <><p className="mt-3 text-body-md text-text-secondary">Imtihon barcha darslar o‘zlashtirilgach ochiladi.</p><ul className="mt-3 list-disc pl-5 text-body-sm text-text-secondary">{data.remainingRequirements.slice(0, 4).map((item) => <li key={item}>{item}</li>)}</ul></>}
  </Card>;
}
