import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, Card } from '../../../components';
import { useStudentCourses } from '../../student-courses';
import { useStudentQuestion, useStudentQuestions } from '../question-answers.hooks';
import { questionAnswerPaths } from '../question-answers.routes';

export default function StudentQuestionsPage() {
  const { id } = useParams();
  return id ? <StudentQuestionDetail id={id} /> : <StudentQuestionList />;
}

function StudentQuestionList() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { list, create } = useStudentQuestions();
  const { enrollments } = useStudentCourses();
  const [courseId, setCourseId] = useState(params.get('courseId') ?? '');
  const [lessonId] = useState(params.get('lessonId') ?? '');
  const [body, setBody] = useState('');
  const activeCourses = enrollments.data?.items.filter((item) => item.accessActive) ?? [];

  return (
    <div className="mx-auto max-w-content">
      <h1 className="type-heading-1">Savollarim</h1>
      <p className="mt-2 text-body-md text-text-secondary">O‘qituvchingizga kurs bo‘yicha savol yuboring.</p>
      <Card className="mt-6" padding="lg">
        <h2 className="type-heading-3">Yangi savol</h2>
        {courseId ? (
          <p className="mt-3 text-body-sm text-text-secondary">Kursga bog‘langan savol{lessonId ? ' · tanlangan dars' : ''}.</p>
        ) : (
          <>
            <label className="mt-4 block text-label-md" htmlFor="question-course">Kurs</label>
            <select className="mt-2 min-h-target w-full rounded-md border border-border-control bg-surface px-3" id="question-course" onChange={(event) => setCourseId(event.target.value)} value={courseId}>
              <option value="">Kursni tanlang</option>
              {activeCourses.map((enrollment) => <option key={enrollment.courseId} value={enrollment.courseId}>{enrollment.course.title}</option>)}
            </select>
            {!enrollments.isPending && activeCourses.length === 0 ? <p className="mt-2 text-body-sm text-text-secondary">Savol yuborish uchun faol kursga yozilgan bo‘lishingiz kerak.</p> : null}
          </>
        )}
        <label className="mt-4 block text-label-md" htmlFor="question-body">Savol</label>
        <textarea className="mt-2 min-h-32 w-full rounded-md border border-border-control p-3" id="question-body" maxLength={5000} onChange={(event) => setBody(event.target.value)} value={body} />
        {create.isError ? <p className="mt-2 text-danger-text" role="alert">Savol yuborilmadi. Faol kursga yozilganingizni tekshiring.</p> : null}
        <Button className="mt-4" disabled={!courseId || !body.trim() || create.isPending} loading={create.isPending} onClick={() => create.mutate({ courseId, ...(lessonId ? { lessonId } : {}), body }, { onSuccess: (thread) => { setBody(''); navigate(questionAnswerPaths.studentDetail(thread.id)); } })}>Savol yuborish</Button>
      </Card>
      <section className="mt-8">
        <h2 className="type-heading-2">Mavjud savollar</h2>
        {list.isPending ? <p className="mt-3" role="status">Yuklanmoqda…</p> : null}
        {list.isError ? <p className="mt-3 text-danger-text" role="alert">Savollarni yuklab bo‘lmadi.</p> : null}
        {!list.isPending && !list.isError && list.data?.items.length === 0 ? <p className="mt-3 text-text-secondary">Hozircha savollar yo‘q.</p> : null}
        <div className="mt-4 grid gap-3">{list.data?.items.map((thread) => <Link className="rounded-lg border border-border-decorative p-4 no-underline" key={thread.id} to={questionAnswerPaths.studentDetail(thread.id)}><div className="flex flex-wrap justify-between gap-2"><strong>{thread.subject ?? thread.course.title}</strong><span>{thread.status}</span></div><p className="mt-2 text-body-sm text-text-secondary">{thread.latestMessage?.body ?? ''}</p></Link>)}</div>
      </section>
    </div>
  );
}

function StudentQuestionDetail({ id }: { id: string }) {
  const { query, send } = useStudentQuestion(id);
  const [body, setBody] = useState('');
  const thread = query.data;
  if (query.isPending) return <p role="status">Yuklanmoqda…</p>;
  if (query.isError || !thread) return <p role="alert">Savol topilmadi.</p>;
  return <div className="mx-auto max-w-reading"><Link to={questionAnswerPaths.student}>← Savollarim</Link><h1 className="type-heading-1 mt-4">{thread.subject ?? thread.course.title}</h1><p className="mt-2 text-body-sm text-text-secondary">{thread.lesson?.title ?? 'Kurs savoli'} · {thread.status}</p><div className="mt-6 grid gap-3">{thread.messages?.map((message) => <Card key={message.id} padding="lg"><p className="text-caption text-text-muted">{message.senderRole === 'TEACHER' ? 'O‘qituvchi' : 'Siz'}</p><p className="mt-2 whitespace-pre-wrap">{message.body}</p></Card>)}</div>{thread.status !== 'CLOSED' ? <Card className="mt-6" padding="lg"><textarea aria-label="Xabar matni" className="min-h-28 w-full rounded-md border p-3" maxLength={5000} onChange={(event) => setBody(event.target.value)} value={body} />{send.isError ? <p className="mt-2 text-danger-text" role="alert">Xabar yuborilmadi. Kursga kirish muddati tugagan bo‘lishi mumkin.</p> : null}<Button className="mt-3" disabled={!body.trim() || send.isPending} loading={send.isPending} onClick={() => send.mutate(body, { onSuccess: () => setBody('') })}>Xabar yuborish</Button></Card> : null}</div>;
}
