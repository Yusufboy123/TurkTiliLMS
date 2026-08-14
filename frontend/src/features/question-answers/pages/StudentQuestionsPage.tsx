import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Badge, Button, Card } from '../../../components';
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
      <header className="max-w-reading">
        <p className="text-label-md font-semibold uppercase tracking-[0.12em] text-brand-text">Aloqa</p>
        <h1 className="mt-2 type-heading-1">Savollarim</h1>
        <p className="mt-3 text-body-md text-text-secondary">O‘qituvchingizga kurs bo‘yicha savol yuboring va javoblarni shu yerda kuzating.</p>
      </header>

      <Card className="mt-8 border-action-primary-border/40" padding="lg">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-action-primary-bg text-button text-action-primary-text">?</span>
          <div>
            <h2 className="type-heading-3">Yangi savol</h2>
            <p className="mt-1 text-body-sm text-text-secondary">Kurs yoki dars bo‘yicha tushunmagan joyingizni yozing.</p>
          </div>
        </div>
        {courseId ? (
          <p className="mt-5 rounded-lg bg-info-bg px-3 py-2 text-body-sm text-info-text">Kursga bog‘langan savol{lessonId ? ' · tanlangan dars' : ''}.</p>
        ) : (
          <>
            <label className="mt-5 block text-label-md" htmlFor="question-course">Kurs</label>
            <select className="mt-2 min-h-target w-full rounded-xl border border-border-control bg-surface px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" id="question-course" onChange={(event) => setCourseId(event.target.value)} value={courseId}>
              <option value="">Kursni tanlang</option>
              {activeCourses.map((enrollment) => <option key={enrollment.id} value={enrollment.courseId}>{enrollment.course.title}</option>)}
            </select>
            {!enrollments.isPending && activeCourses.length === 0 ? <p className="mt-2 text-body-sm text-text-secondary">Savol yuborish uchun faol kursga yozilgan bo‘lishingiz kerak.</p> : null}
          </>
        )}
        <label className="mt-5 block text-label-md" htmlFor="question-body">Savol</label>
        <textarea className="mt-2 min-h-32 w-full rounded-xl border border-border-control bg-surface p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" id="question-body" maxLength={5000} onChange={(event) => setBody(event.target.value)} placeholder="Savolingizni aniq va qisqa yozing" value={body} />
        {create.isError ? <p className="mt-2 text-body-sm text-danger-text" role="alert">Savol yuborilmadi. Faol kursga yozilganingizni tekshiring.</p> : null}
        <Button className="mt-4" disabled={!courseId || !body.trim() || create.isPending} loading={create.isPending} onClick={() => create.mutate({ courseId, ...(lessonId ? { lessonId } : {}), body }, { onSuccess: (thread) => { setBody(''); navigate(questionAnswerPaths.studentDetail(thread.id)); } })}>Savol yuborish</Button>
      </Card>

      <section aria-labelledby="student-question-list" className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="type-heading-2" id="student-question-list">Mavjud savollar</h2>
            <p className="mt-1 text-body-sm text-text-secondary">Yuborgan savollaringiz va o‘qituvchi javoblari.</p>
          </div>
          {list.data ? <span className="rounded-full bg-neutral-bg px-3 py-1 text-label-sm text-neutral-text">{list.data.items.length}</span> : null}
        </div>
        {list.isPending ? <p className="mt-5 rounded-xl border border-border-decorative bg-surface p-6 text-body-sm text-text-secondary" role="status">Savollar yuklanmoqda…</p> : null}
        {list.isError ? <Card className="mt-5 border-danger-border bg-danger-bg" role="alert"><p className="text-body-sm text-danger-text">Savollarni yuklab bo‘lmadi.</p><Button className="mt-4" intent="secondary" onClick={() => void list.refetch()}>Qayta urinish</Button></Card> : null}
        {!list.isPending && !list.isError && list.data?.items.length === 0 ? <Card className="mt-5 border-dashed py-8 text-center" elevation="none"><p className="text-body-sm text-text-secondary">Hozircha savollar yo‘q.</p></Card> : null}
        <div className="mt-5 grid gap-3">{list.data?.items.map((thread) => <Link className="group rounded-xl border border-border-decorative bg-surface p-5 no-underline shadow-subtle transition-colors hover:border-action-primary-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" key={thread.id} to={questionAnswerPaths.studentDetail(thread.id)}><div className="flex flex-wrap items-start justify-between gap-3"><strong className="type-heading-4 text-text-primary group-hover:text-action-primary-text">{thread.subject ?? thread.course.title}</strong><Badge intent={thread.status === 'CLOSED' ? 'neutral' : 'info'}>{thread.status}</Badge></div><p className="mt-3 line-clamp-2 text-body-sm text-text-secondary">{thread.latestMessage?.body ?? 'Savol yuborildi.'}</p></Link>)}</div>
      </section>
    </div>
  );
}

function StudentQuestionDetail({ id }: { id: string }) {
  const { query, send } = useStudentQuestion(id);
  const [body, setBody] = useState('');
  const thread = query.data;
  if (query.isPending) return <p className="rounded-xl border border-border-decorative bg-surface p-6 text-body-sm text-text-secondary" role="status">Savol yuklanmoqda…</p>;
  if (query.isError || !thread) return <Card className="border-danger-border bg-danger-bg" role="alert"><p className="text-danger-text">Savol topilmadi.</p></Card>;
  return <div className="mx-auto max-w-reading"><Link className="text-button" to={questionAnswerPaths.student}>← Savollarim</Link><div className="mt-5"><p className="text-label-md font-semibold uppercase tracking-[0.12em] text-brand-text">Savol tafsilotlari</p><h1 className="mt-2 type-heading-1">{thread.subject ?? thread.course.title}</h1><p className="mt-2 text-body-sm text-text-secondary">{thread.lesson?.title ?? 'Kurs savoli'} · {thread.status}</p></div><div className="mt-8 grid gap-3">{thread.messages?.map((message) => <Card key={message.id} padding="lg"><p className="text-caption font-semibold text-text-muted">{message.senderRole === 'TEACHER' ? 'O‘qituvchi' : 'Siz'}</p><p className="mt-2 whitespace-pre-wrap text-body-md">{message.body}</p></Card>)}</div>{thread.status !== 'CLOSED' ? <Card className="mt-6" padding="lg"><label className="text-label-md" htmlFor="reply-body">Javobingiz</label><textarea aria-label="Xabar matni" className="mt-2 min-h-28 w-full rounded-xl border border-border-control bg-surface p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" id="reply-body" maxLength={5000} onChange={(event) => setBody(event.target.value)} value={body} />{send.isError ? <p className="mt-2 text-body-sm text-danger-text" role="alert">Xabar yuborilmadi. Kursga kirish muddati tugagan bo‘lishi mumkin.</p> : null}<Button className="mt-3" disabled={!body.trim() || send.isPending} loading={send.isPending} onClick={() => send.mutate(body, { onSuccess: () => setBody('') })}>Xabar yuborish</Button></Card> : null}</div>;
}
