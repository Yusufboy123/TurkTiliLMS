import { useState } from 'react';
import { Button, Card, FormField, Input } from '../../../components';
import { useStudentLessonQuiz, useStudentLessonVocabulary } from '../hooks/use-student-player';
import type { StudentQuizAnswerInput, StudentQuizQuestion } from '../types/student-player.types';

export function StudentVocabularyPanel({ enrollmentId, lessonId, enabled }: { enrollmentId: string; lessonId: string; enabled: boolean }) {
  const vocabulary = useStudentLessonVocabulary(enrollmentId, lessonId, enabled);
  if (vocabulary.isPending) return <section className="mt-10" aria-labelledby="new-words-heading"><h2 className="type-heading-2" id="new-words-heading">Yangi so‘zlar</h2><p className="mt-4" role="status">Yuklanmoqda...</p></section>;
  if (vocabulary.isError) return <p className="mt-6 text-body-sm text-warning-text" role="status">Yangi so‘zlar hozircha yuklanmadi.</p>;
  return <section aria-labelledby="new-words-heading" className="mt-10"><h2 className="type-heading-2" id="new-words-heading">Yangi so‘zlar</h2>{vocabulary.data?.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{vocabulary.data.map((item) => <Card elevation="none" key={item.id} padding="lg"><p className="text-label-md">{item.position}. {item.turkishWord}</p><p className="mt-2 text-body-md">{item.uzbekMeaning}</p>{item.exampleSentence ? <p className="mt-2 text-body-sm text-text-secondary">{item.exampleSentence}</p> : null}</Card>)}</div> : <p className="mt-4 text-body-sm text-text-secondary">Bu darsda yangi so‘zlar yo‘q.</p>}</section>;
}

function QuestionAnswer({ question, value, onChange }: { question: StudentQuizQuestion; value: string; onChange: (value: string) => void }) {
  if (question.type === 'MISSING_WORD') return <FormField label="Javob" required><Input onChange={(event) => onChange(event.target.value)} required value={value} /></FormField>;
  return <fieldset className="grid gap-2"><legend className="text-label-md">Javobni tanlang</legend>{question.options.map((option) => <label className="flex min-h-target items-center gap-3 rounded-md border border-border-decorative px-3 py-2 text-body-sm" key={option.id}><input checked={value === option.id} name={`question-${question.id}`} onChange={() => onChange(option.id)} required type="radio" />{option.text}</label>)}</fieldset>;
}

export function StudentQuizPanel({ enrollmentId, lessonId, enabled }: { enrollmentId: string; lessonId: string; enabled: boolean }) {
  const { quiz, latestResult, start, submit } = useStudentLessonQuiz(enrollmentId, lessonId, enabled);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const questions = quiz.data?.questions ?? [];
  const result = latestResult.data;
  const begin = () => { start.mutate(undefined, { onSuccess: (attempt) => { setAttemptId(attempt.id); setAnswers({}); } }); };
  const submitAnswers = () => { if (!attemptId) return; const input: StudentQuizAnswerInput[] = questions.map((question) => ({ questionId: question.id, submittedAnswer: answers[question.id] ?? '' })); submit.mutate({ attemptId, answers: input }, { onSuccess: () => { setAttemptId(null); setAnswers({}); } }); };
  if (!enabled) return null;
  if (quiz.isPending || latestResult.isPending) return <section className="mt-10" aria-labelledby="final-quiz-heading"><h2 className="type-heading-2" id="final-quiz-heading">Yakuniy test</h2><p className="mt-4" role="status">Yuklanmoqda...</p></section>;
  if (quiz.isError) return <p className="mt-6 text-body-sm text-warning-text" role="status">Yakuniy test hozircha yuklanmadi.</p>;
  if (!questions.length) return null;
  return <section aria-labelledby="final-quiz-heading" className="mt-10"><h2 className="type-heading-2" id="final-quiz-heading">Yakuniy test</h2>{result && !attemptId ? <Card className="mt-5 border-success-border bg-success-bg" padding="lg"><p className="text-label-md text-success-text">Oxirgi natija</p><p className="mt-2 text-heading-3">{result.score}/{result.maxScore} ball · {result.percentage}%</p><p className="mt-2 text-body-sm text-success-text">To‘g‘ri: {result.correctCount} · Noto‘g‘ri: {result.incorrectCount}</p><Button className="mt-4" disabled={start.isPending} loading={start.isPending} onClick={begin}>Qayta ishlash</Button></Card> : null}{!result && !attemptId ? <Card className="mt-5" padding="lg"><p className="text-body-md text-text-secondary">Bilimingizni tekshirish uchun testni boshlang.</p><Button className="mt-4" disabled={start.isPending} loading={start.isPending} onClick={begin}>Testni boshlash</Button></Card> : null}{attemptId ? <Card className="mt-5" padding="lg"><div className="grid gap-6">{questions.map((question, index) => <div className="grid gap-3" key={question.id}><p className="text-label-md">{index + 1}. {question.prompt} <span className="text-text-muted">({question.points} ball)</span></p><QuestionAnswer onChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))} question={question} value={answers[question.id] ?? ''} /></div>)}</div><Button className="mt-6" disabled={submit.isPending || questions.some((question) => !answers[question.id]?.trim())} loading={submit.isPending} onClick={submitAnswers}>Testni topshirish</Button>{submit.isError ? <p className="mt-3 text-danger-text" role="alert">Javoblarni yuborib bo‘lmadi. Qayta urinib ko‘ring.</p> : null}</Card> : null}</section>;
}
