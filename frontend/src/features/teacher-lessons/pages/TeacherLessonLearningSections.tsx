import { useState, type FormEvent } from 'react';
import { Badge, Button, Card, FormField, Input, Select, Textarea } from '../../../components';
import {
  useCreateTeacherQuizQuestion,
  useCreateTeacherVocabulary,
  useDeleteTeacherQuizQuestion,
  useDeleteTeacherVocabulary,
  useTeacherLessonQuizQuestions,
  useTeacherLessonQuizResults,
  useTeacherLessonVocabulary,
  useUpdateTeacherQuizQuestion,
  useUpdateTeacherVocabulary,
} from '../hooks/use-teacher-lessons';
import type {
  TeacherQuizOptionInput,
  TeacherQuizQuestion,
  TeacherQuizQuestionType,
  TeacherVocabulary,
} from '../types/teacher-lessons.types';

const questionTypeLabels: Record<TeacherQuizQuestionType, string> = {
  MULTIPLE_CHOICE: 'Bir nechta variant',
  TRUE_FALSE: 'To‘g‘ri / Noto‘g‘ri',
  MISSING_WORD: 'Tushib qolgan so‘z',
};

function VocabularyForm({
  courseId,
  lessonId,
  vocabulary,
  onDone,
}: {
  courseId: string;
  lessonId: string;
  vocabulary?: TeacherVocabulary;
  onDone: () => void;
}) {
  const create = useCreateTeacherVocabulary(courseId, lessonId);
  const update = useUpdateTeacherVocabulary(courseId, lessonId);
  const [turkishWord, setTurkishWord] = useState(vocabulary?.turkishWord ?? '');
  const [uzbekMeaning, setUzbekMeaning] = useState(vocabulary?.uzbekMeaning ?? '');
  const [exampleSentence, setExampleSentence] = useState(vocabulary?.exampleSentence ?? '');
  const [position, setPosition] = useState(String(vocabulary?.position ?? ''));
  const pending = create.isPending || update.isPending;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = {
      turkishWord: turkishWord.trim(),
      uzbekMeaning: uzbekMeaning.trim(),
      exampleSentence: exampleSentence.trim() || null,
      ...(position ? { position: Math.max(1, Number(position) || 1) } : {}),
    };
    if (vocabulary) update.mutate({ vocabularyId: vocabulary.id, input }, { onSuccess: onDone });
    else create.mutate(input, { onSuccess: onDone });
  };

  return (
    <form className="grid gap-4 rounded-lg border border-border-decorative bg-subtle p-4" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Turkcha so‘z" required><Input onChange={(event) => setTurkishWord(event.target.value)} required value={turkishWord} /></FormField>
        <FormField label="O‘zbekcha ma’no" required><Input onChange={(event) => setUzbekMeaning(event.target.value)} required value={uzbekMeaning} /></FormField>
      </div>
      <FormField label="Misol gap"><Textarea onChange={(event) => setExampleSentence(event.target.value)} value={exampleSentence} /></FormField>
      <FormField label="Tartib"><Input min={1} onChange={(event) => setPosition(event.target.value)} type="number" value={position} /></FormField>
      <div className="flex flex-wrap gap-2"><Button disabled={pending || !turkishWord.trim() || !uzbekMeaning.trim()} loading={pending} type="submit">Saqlash</Button><Button intent="secondary" onClick={onDone} type="button">Bekor qilish</Button></div>
    </form>
  );
}

export function TeacherVocabularyPanel({ courseId, lessonId, canUpdate }: { courseId: string; lessonId: string; canUpdate: boolean }) {
  const vocabulary = useTeacherLessonVocabulary(courseId, lessonId);
  const remove = useDeleteTeacherVocabulary(courseId, lessonId);
  const create = useCreateTeacherVocabulary(courseId, lessonId);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="type-heading-3">Lug‘atlar</h2><p className="mt-2 text-body-sm text-text-secondary">Darsdagi yangi so‘zlarni boshqaring.</p></div>{canUpdate ? <Button intent="secondary" onClick={() => setEditing('new')}>So‘z qo‘shish</Button> : null}</div>
      {editing === 'new' ? <div className="mt-5"><VocabularyForm courseId={courseId} lessonId={lessonId} onDone={() => setEditing(null)} /></div> : null}
      {vocabulary.isPending ? <p className="mt-5" role="status">Yuklanmoqda...</p> : null}
      {vocabulary.isError ? <p className="mt-5 text-danger-text" role="alert">Lug‘atlarni yuklab bo‘lmadi.</p> : null}
      {!vocabulary.isPending && !vocabulary.isError && vocabulary.data?.length === 0 ? <p className="mt-5 text-body-sm text-text-secondary">Hozircha lug‘at yo‘q.</p> : null}
      <div className="mt-5 grid gap-3">{vocabulary.data?.map((item) => editing === item.id ? <VocabularyForm courseId={courseId} key={item.id} lessonId={lessonId} onDone={() => setEditing(null)} vocabulary={item} /> : (
        <div className="rounded-lg border border-border-decorative p-4" key={item.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-label-md">{item.position}. {item.turkishWord}</p><p className="mt-1 text-body-md">{item.uzbekMeaning}</p>{item.exampleSentence ? <p className="mt-2 text-body-sm text-text-secondary">{item.exampleSentence}</p> : null}</div>{canUpdate ? <div className="flex flex-wrap gap-2"><Button intent="secondary" onClick={() => setEditing(item.id)} size="sm">Tahrirlash</Button><Button disabled={create.isPending} intent="secondary" onClick={() => create.mutate({ turkishWord: item.turkishWord + ' (nusxa)', uzbekMeaning: item.uzbekMeaning, exampleSentence: item.exampleSentence })} size="sm">Nusxalash</Button><Button disabled={remove.isPending} intent="secondary" onClick={() => { if (window.confirm('Bu so‘z o‘chirilsinmi?')) remove.mutate(item.id); }} size="sm">O‘chirish</Button></div> : null}</div></div>
      ))}</div>
    </Card>
  );
}

function QuestionForm({ courseId, lessonId, question, onDone }: { courseId: string; lessonId: string; question?: TeacherQuizQuestion; onDone: () => void }) {
  const create = useCreateTeacherQuizQuestion(courseId, lessonId);
  const update = useUpdateTeacherQuizQuestion(courseId, lessonId);
  const [type, setType] = useState<TeacherQuizQuestionType>(question?.type ?? 'MULTIPLE_CHOICE');
  const [prompt, setPrompt] = useState(question?.prompt ?? '');
  const [explanation, setExplanation] = useState(question?.explanation ?? '');
  const [points, setPoints] = useState(String(question?.points ?? 1));
  const [position, setPosition] = useState(String(question?.position ?? ''));
  const [options, setOptions] = useState<TeacherQuizOptionInput[]>(question?.options.map(({ text, isCorrect, position: itemPosition }) => ({ text, isCorrect, position: itemPosition })) ?? [{ text: '', isCorrect: true }, { text: '', isCorrect: false }]);
  const pending = create.isPending || update.isPending;
  const setTypeAndOptions = (next: TeacherQuizQuestionType) => { setType(next); if (next === 'TRUE_FALSE') setOptions([{ text: 'To‘g‘ri', isCorrect: true, position: 1 }, { text: 'Noto‘g‘ri', isCorrect: false, position: 2 }]); else if (next === 'MISSING_WORD') setOptions([{ text: '', isCorrect: true, position: 1 }]); else setOptions(options.length >= 2 ? options : [{ text: '', isCorrect: true }, { text: '', isCorrect: false }]); };
  const updateOption = (index: number, value: Partial<TeacherQuizOptionInput>) => setOptions((current) => current.map((option, optionIndex) => optionIndex === index ? { ...option, ...value } : option));
  const selectCorrect = (index: number) => setOptions((current) => current.map((option, optionIndex) => ({ ...option, isCorrect: optionIndex === index })));
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const input = { type, prompt: prompt.trim(), explanation: explanation.trim() || null, points: Math.max(1, Number(points) || 1), ...(position ? { position: Math.max(1, Number(position) || 1) } : {}), options: options.map((option, index) => ({ ...option, text: option.text.trim(), position: index + 1 })) }; if (question) update.mutate({ questionId: question.id, input }, { onSuccess: onDone }); else create.mutate(input, { onSuccess: onDone }); };
  return <form className="grid gap-4 rounded-lg border border-border-decorative bg-subtle p-4" onSubmit={submit}><FormField label="Savol" required><Textarea onChange={(event) => setPrompt(event.target.value)} required value={prompt} /></FormField><div className="grid gap-4 sm:grid-cols-2"><FormField label="Turi" required><Select onChange={(event) => setTypeAndOptions(event.target.value as TeacherQuizQuestionType)} value={type}>{Object.entries(questionTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></FormField><FormField label="Ball" required><Input min={1} onChange={(event) => setPoints(event.target.value)} required type="number" value={points} /></FormField></div><FormField label="Izoh"><Textarea onChange={(event) => setExplanation(event.target.value)} value={explanation} /></FormField><FormField label="Tartib"><Input min={1} onChange={(event) => setPosition(event.target.value)} type="number" value={position} /></FormField><fieldset className="grid gap-3"><legend className="text-label-md">{type === 'MISSING_WORD' ? 'To‘g‘ri javob' : 'Variantlar'}</legend>{options.map((option, index) => <div className="flex flex-wrap items-center gap-2" key={index}><Input aria-label={`Variant ${index + 1}`} className="min-w-0 flex-1" disabled={type === 'TRUE_FALSE'} onChange={(event) => updateOption(index, { text: event.target.value })} required value={option.text} /><label className="flex min-h-target items-center gap-2 text-body-sm"><input checked={option.isCorrect} disabled={type === 'MISSING_WORD'} name="correct-option" onChange={() => selectCorrect(index)} type="radio" /> To‘g‘ri</label>{type === 'MULTIPLE_CHOICE' && options.length > 2 ? <Button intent="secondary" onClick={() => setOptions((current) => current.filter((_, optionIndex) => optionIndex !== index))} size="sm" type="button">O‘chirish</Button> : null}</div>)}{type === 'MULTIPLE_CHOICE' ? <Button intent="secondary" onClick={() => setOptions((current) => [...current, { text: '', isCorrect: false, position: current.length + 1 }])} size="sm" type="button">Variant qo‘shish</Button> : null}</fieldset><div className="flex flex-wrap gap-2"><Button disabled={pending || !prompt.trim()} loading={pending} type="submit">Saqlash</Button><Button intent="secondary" onClick={onDone} type="button">Bekor qilish</Button></div></form>;
}

export function TeacherQuizPanel({ courseId, lessonId, canUpdate }: { courseId: string; lessonId: string; canUpdate: boolean }) {
  const questions = useTeacherLessonQuizQuestions(courseId, lessonId);
  const remove = useDeleteTeacherQuizQuestion(courseId, lessonId);
  const create = useCreateTeacherQuizQuestion(courseId, lessonId);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  return <Card><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="type-heading-3">Test</h2><p className="mt-2 text-body-sm text-text-secondary">Uchta qo‘llab-quvvatlanadigan savol turidan foydalaning.</p></div>{canUpdate ? <Button intent="secondary" onClick={() => setEditing('new')}>Savol qo‘shish</Button> : null}</div>{editing === 'new' ? <div className="mt-5"><QuestionForm courseId={courseId} lessonId={lessonId} onDone={() => setEditing(null)} /></div> : null}{questions.isPending ? <p className="mt-5" role="status">Yuklanmoqda...</p> : null}{questions.isError ? <p className="mt-5 text-danger-text" role="alert">Test savollarini yuklab bo‘lmadi.</p> : null}<div className="mt-5 grid gap-3">{questions.data?.map((question) => editing === question.id ? <QuestionForm courseId={courseId} key={question.id} lessonId={lessonId} onDone={() => setEditing(null)} question={question} /> : <div className="rounded-lg border border-border-decorative p-4" key={question.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><Badge intent="info">{questionTypeLabels[question.type]}</Badge><h3 className="type-heading-4 mt-2">{question.position}. {question.prompt}</h3><p className="mt-1 text-body-sm text-text-secondary">{question.points} ball · {question.options.length} variant</p></div>{canUpdate ? <div className="flex flex-wrap gap-2"><Button intent="secondary" onClick={() => setEditing(question.id)} size="sm">Tahrirlash</Button><Button disabled={create.isPending} intent="secondary" onClick={() => create.mutate({ type: question.type, prompt: question.prompt + ' (nusxa)', points: question.points, explanation: question.explanation, options: question.options.map(o => ({ text: o.text, isCorrect: o.isCorrect, position: o.position })) })} size="sm">Nusxalash</Button><Button disabled={remove.isPending} intent="secondary" onClick={() => { if (window.confirm('Bu savol o‘chirilsinmi?')) remove.mutate(question.id); }} size="sm">O‘chirish</Button></div> : null}</div></div>)}</div>{!questions.isPending && !questions.isError && questions.data?.length === 0 ? <p className="mt-5 text-body-sm text-text-secondary">Hozircha test savoli yo‘q.</p> : null}</Card>;
}

export function TeacherQuizResultsPanel({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const results = useTeacherLessonQuizResults(courseId, lessonId);
  return <Card><h2 className="type-heading-3">Natijalar</h2>{results.isPending ? <p className="mt-5" role="status">Yuklanmoqda...</p> : null}{results.isError ? <p className="mt-5 text-danger-text" role="alert">Natijalarni yuklab bo‘lmadi.</p> : null}{!results.isPending && !results.isError && results.data?.length === 0 ? <p className="mt-5 text-body-sm text-text-secondary">Hozircha topshirilgan natija yo‘q.</p> : null}<div className="mt-5 grid gap-3">{results.data?.map((result) => <article className="rounded-lg border border-border-decorative p-4" key={result.student.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="type-heading-4">{result.student.name}</h3><p className="mt-1 break-all text-body-sm text-text-secondary">{result.student.email}</p></div><Badge intent={result.percentage === null ? 'neutral' : 'success'}>{result.percentage === null ? 'Topshirmagan' : `${result.percentage}%`}</Badge></div>{result.submittedAt ? <p className="mt-3 text-body-sm text-text-secondary">{result.score}/{result.maxScore} ball · {new Date(result.submittedAt).toLocaleString('uz-UZ')}</p> : null}</article>)}</div></Card>;
}
