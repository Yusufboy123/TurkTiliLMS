import { useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge, Button, Card, Input, Select, Textarea } from '../../../components';
import { useAuth } from '../../auth';
import { useAdminActivity } from '../admin-activity.hooks';
import { useCreateAnnouncement } from '../../notifications';

const actionLabels: Record<string, string> = {
  'users.roles.replaced': 'Foydalanuvchi roli o‘zgartirildi',
  'users.status.active': 'Foydalanuvchi faollashtirildi',
  'users.status.suspended': 'Foydalanuvchi to‘xtatildi',
  'users.status.deactivated': 'Foydalanuvchi faolsizlantirildi',
  'users.deleted': 'Foydalanuvchi o‘chirildi',
  'users.restored': 'Foydalanuvchi tiklandi',
  'groups.created': 'Guruh yaratildi',
  'groups.deleted': 'Guruh arxivlandi',
  'groups.restored': 'Guruh tiklandi',
  'groups.student_added': 'Talaba guruhga qo‘shildi',
  'groups.student_removed': 'Talaba guruhdan chiqarildi',
  'courses.created': 'Kurs yaratildi',
  'courses.status_changed': 'Kurs holati o‘zgartirildi',
  'courses.published': 'Kurs nashr qilindi',
  LESSON_CREATED: 'Dars yaratildi',
  LESSON_DUPLICATED: 'Dars nusxalandi',
  LESSON_DELETED: 'Dars o‘chirildi',
  'course_enrollments.created': 'Kursga yozilish yaratildi',
  'course_enrollments.access_updated': 'Kurs muddati o‘zgartirildi',
  'certificate.issued': 'Sertifikat berildi',
  'certificate.revoked': 'Sertifikat bekor qilindi',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('uz-Latn-UZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function AdminActivityPage() {
  const auth = useAuth();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const action = params.get('action') ?? '';
  const entityType = params.get('entityType') ?? '';
  const query = useMemo(() => ({ page, pageSize: 20, ...(action ? { action } : {}), ...(entityType ? { entityType } : {}) }), [action, entityType, page]);
  const activity = useAdminActivity(query, auth.status === 'authenticated' && auth.roles.includes('ADMIN'));
  const announcement = useCreateAnnouncement();
  const [audience, setAudience] = useState<'STUDENT' | 'TEACHER' | 'ALL'>('ALL');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const submitAnnouncement = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    announcement.mutate({ audience, title: title.trim(), message: message.trim(), ...(targetUrl.trim() ? { targetUrl: targetUrl.trim() } : {}) }, { onSuccess: () => { setTitle(''); setMessage(''); setTargetUrl(''); } });
  };
  const setParam = (key: 'action' | 'entityType', value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    next.delete('page');
    setParams(next);
  };
  const changePage = (nextPage: number) => {
    const next = new URLSearchParams(params);
    next.set('page', String(nextPage));
    setParams(next);
  };

  return (
    <>
      <header>
        <p className="text-label-md text-brand-text">Admin bo‘limi</p>
        <h1 className="type-heading-1 mt-2">Faoliyat tarixi</h1>
        <p className="mt-3 max-w-reading text-body-md text-text-secondary">Muhim boshqaruv amallari jurnali.</p>
      </header>
      <section aria-label="Faoliyat filtrlari" className="mt-8 grid gap-4 rounded-lg border border-border-decorative bg-surface p-5 md:grid-cols-2">
        <label className="grid gap-2 text-label-md" htmlFor="activity-action">Amal
          <Input id="activity-action" onChange={(event) => setParam('action', event.target.value)} placeholder="Masalan: users.deleted" value={action} />
        </label>
        <label className="grid gap-2 text-label-md" htmlFor="activity-entity">Obyekt turi
          <Select id="activity-entity" onChange={(event) => setParam('entityType', event.target.value)} value={entityType}>
            <option value="">Barchasi</option><option value="user">Foydalanuvchi</option><option value="group">Guruh</option><option value="course">Kurs</option><option value="lesson">Dars</option><option value="course_enrollment">Enrollment</option><option value="certificate">Sertifikat</option>
          </Select>
        </label>
      </section>
      {auth.status === 'authenticated' && auth.roles.includes('ADMIN') ? (
        <Card className="mt-6">
          <h2 className="text-heading-4">E’lon yuborish</h2>
          <form className="mt-4 grid gap-4" onSubmit={submitAnnouncement}>
            <label className="grid gap-2 text-label-md" htmlFor="announcement-audience">Kimlarga
              <Select id="announcement-audience" onChange={(event) => setAudience(event.target.value as typeof audience)} value={audience}><option value="ALL">Barchaga</option><option value="STUDENT">Talabalarga</option><option value="TEACHER">O‘qituvchilarga</option></Select>
            </label>
            <label className="grid gap-2 text-label-md" htmlFor="announcement-title">Sarlavha<Input id="announcement-title" maxLength={200} onChange={(event) => setTitle(event.target.value)} required value={title} /></label>
            <label className="grid gap-2 text-label-md" htmlFor="announcement-message">Xabar<Textarea id="announcement-message" maxLength={1000} onChange={(event) => setMessage(event.target.value)} required value={message} /></label>
            <label className="grid gap-2 text-label-md" htmlFor="announcement-target">Ichki havola (ixtiyoriy)<Input id="announcement-target" onChange={(event) => setTargetUrl(event.target.value)} placeholder="/app/courses" value={targetUrl} /></label>
            {announcement.isError ? <p className="text-danger-text" role="alert">E’lon yuborilmadi.</p> : null}
            {announcement.isSuccess ? <p className="text-success-text" role="status">E’lon yuborildi.</p> : null}
            <Button disabled={announcement.isPending} loading={announcement.isPending} type="submit">Yuborish</Button>
          </form>
        </Card>
      ) : null}
      {activity.isPending ? <p className="mt-8" role="status">Yuklanmoqda…</p> : null}
      {activity.isError ? <Card className="mt-8 border-danger-border bg-danger-bg" role="alert"><p className="text-danger-text">Faoliyat tarixini yuklab bo‘lmadi.</p><Button className="mt-4" intent="secondary" onClick={() => void activity.refetch()}>Qayta urinish</Button></Card> : null}
      {activity.data?.items.length === 0 ? <Card className="mt-8"><p className="text-body-md text-text-secondary">Faoliyat yozuvlari topilmadi.</p></Card> : null}
      {activity.data && activity.data.items.length > 0 ? <div className="mt-8 grid gap-3">{activity.data.items.map((item) => <article className="rounded-lg border border-border-decorative bg-surface p-4" key={item.id}><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold break-words">{item.actor?.name ?? 'Tizim'}</p><p className="mt-1 break-words text-body-sm text-text-secondary">{actionLabels[item.action] ?? item.action}</p></div><Badge intent="neutral">{item.entityType}</Badge></div><p className="mt-3 break-words text-body-sm">{item.summary}</p>{item.entityId ? <p className="mt-2 break-all text-caption text-text-muted">ID: {item.entityId}</p> : null}<time className="mt-3 block text-caption text-text-muted" dateTime={item.createdAt}>{formatDate(item.createdAt)}</time></article>)}</div> : null}
      {activity.data && activity.data.pagination.totalPages > 1 ? <nav aria-label="Faoliyat sahifalari" className="mt-6 flex flex-wrap items-center justify-between gap-3"><Button disabled={page <= 1} intent="secondary" onClick={() => changePage(page - 1)}>Avvalgi</Button><span className="text-body-sm text-text-secondary">{page} / {activity.data.pagination.totalPages}</span><Button disabled={page >= activity.data.pagination.totalPages} intent="secondary" onClick={() => changePage(page + 1)}>Keyingi</Button></nav> : null}
    </>
  );
}
