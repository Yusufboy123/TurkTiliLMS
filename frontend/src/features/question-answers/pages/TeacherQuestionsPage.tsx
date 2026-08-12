import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card } from '../../../components';
import { useTeacherQuestion, useTeacherQuestions } from '../question-answers.hooks';
import { questionAnswerPaths } from '../question-answers.routes';
import type { QuestionStatus } from '../question-answers.types';

export default function TeacherQuestionsPage() {
  const { id } = useParams();
  const [status, setStatus] = useState<QuestionStatus | ''>('');
  const { list } = useTeacherQuestions(status || undefined);
  const detail = useTeacherQuestion(id ?? '');
  const [body, setBody] = useState('');
  const thread = detail.query.data ?? (id ? list.data?.items.find((item) => item.id === id) : null);

  return (
    <div className="mx-auto max-w-content">
      <h1 className="type-heading-1">Talabalar savollari</h1>
      <p className="mt-2 text-body-md text-text-secondary">Kurslaringiz bo‘yicha kelgan savollar.</p>
      <label className="mt-5 block max-w-xs text-label-md" htmlFor="question-status">Holat bo‘yicha filtrlash</label>
      <select className="mt-2 min-h-target w-full max-w-xs rounded-md border border-border-control bg-surface px-3" id="question-status" onChange={(event) => setStatus(event.target.value as QuestionStatus | '')} value={status}>
        <option value="">Barchasi</option>
        <option value="OPEN">Ochiq</option>
        <option value="ANSWERED">Javob berilgan</option>
        <option value="CLOSED">Yopilgan</option>
      </select>
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <section className="grid gap-3" aria-label="Savollar ro‘yxati">
          {list.isPending ? <p role="status">Yuklanmoqda…</p> : null}
          {list.isError ? <p className="text-danger-text" role="alert">Savollarni yuklab bo‘lmadi.</p> : null}
          {!list.isPending && !list.isError && list.data?.items.length === 0 ? (
            <p className="text-text-secondary">Hozircha savollar yo‘q.</p>
          ) : null}
          {list.data?.items.map((item) => (
            <Link
              className={`rounded-lg border p-4 no-underline ${item.id === id ? 'border-brand-border bg-brand-soft' : 'border-border-decorative'}`}
              key={item.id}
              to={questionAnswerPaths.teacherDetail(item.id)}
            >
              <strong>{item.student.name}</strong>
              <p className="mt-1 text-body-sm">{item.course.title}</p>
              <p className="mt-1 line-clamp-2 text-body-sm text-text-secondary">{item.latestMessage?.body ?? ''}</p>
              <p className="mt-1 text-caption text-text-muted">{item.status}</p>
              <time className="mt-1 block text-caption text-text-muted" dateTime={item.updatedAt}>{new Date(item.updatedAt).toLocaleString('uz-UZ')}</time>
            </Link>
          ))}
        </section>
        {thread ? (
          <Card padding="lg">
            <h2 className="type-heading-3">{thread.subject ?? thread.course.title}</h2>
            <p className="mt-2 text-body-sm text-text-secondary">{thread.lesson?.title ?? 'Kurs savoli'}</p>
            {detail.query.isError ? <p className="mt-4 text-danger-text" role="alert">Savolni yuklab bo‘lmadi.</p> : null}
            <div className="mt-5 grid gap-3">
              {detail.query.isPending ? <p role="status">Yuklanmoqda…</p> : null}
              {!detail.query.isError && thread.messages?.map((message) => (
                <Card key={message.id} padding="lg">
                  <p className="text-caption text-text-muted">{message.senderRole === 'TEACHER' ? 'Siz' : thread.student.name}</p>
                  <p className="mt-2 whitespace-pre-wrap">{message.body}</p>
                </Card>
              ))}
            </div>
            {thread.status !== 'CLOSED' ? (
              <>
                <textarea
                  aria-label="Javob matni"
                  className="mt-5 min-h-28 w-full rounded-md border p-3"
                  maxLength={5000}
                  onChange={(event) => setBody(event.target.value)}
                  value={body}
                />
                {detail.send.isError ? <p className="mt-2 text-danger-text" role="alert">Javob yuborilmadi.</p> : null}
                <Button className="mt-3" disabled={!body.trim() || detail.send.isPending} loading={detail.send.isPending} onClick={() => detail.send.mutate(body, { onSuccess: () => setBody('') })}>Javob berish</Button>
                <Button className="mt-3 ml-2" disabled={detail.close.isPending} intent="secondary" onClick={() => detail.close.mutate('CLOSED')}>Yopish</Button>
              </>
            ) : (
              <Button className="mt-4" onClick={() => detail.close.mutate('OPEN')}>Qayta ochish</Button>
            )}
          </Card>
        ) : detail.query.isError ? (
          <p className="text-danger-text" role="alert">Savolni yuklab bo‘lmadi.</p>
        ) : (
          <p className="text-text-secondary">Savolni tanlang.</p>
        )}
      </div>
    </div>
  );
}
