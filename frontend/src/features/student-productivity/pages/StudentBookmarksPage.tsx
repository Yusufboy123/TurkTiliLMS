import { Link } from 'react-router-dom';
import { Button, Card } from '../../../components';
import { useBookmarks } from '../student-productivity.hooks';
import type { BookmarkItem } from '../student-productivity.types';

function BookmarkCard({ item, onRemove, pending }: { item: BookmarkItem; onRemove: () => void; pending: boolean }) {
  const isLesson = item.kind === 'LESSON';

  return (
    <Card className="group flex h-full flex-col overflow-hidden" padding="lg">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-label-sm font-semibold text-brand-text">
          <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-lg bg-info-bg text-info-text">
            {isLesson ? 'D' : 'L'}
          </span>
          {isLesson ? 'Dars' : 'Lug‘at'}
        </span>
        <span className="truncate text-caption text-text-muted">{item.courseTitle}</span>
      </div>
      <h3 className="mt-5 type-heading-4 break-words">{item.title}</h3>
      {item.subtitle ? <p className="mt-2 text-body-sm text-text-secondary">{item.subtitle}</p> : null}
      <div className="mt-auto flex flex-wrap gap-3 pt-6">
        <Link
          className="inline-flex min-h-target flex-1 items-center justify-center rounded-xl bg-action-primary-bg px-4 py-3 text-button text-action-primary-text no-underline shadow-subtle transition-colors hover:bg-action-primary-hover-bg visited:text-action-primary-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          to={item.targetUrl}
        >
          Ochish
        </Link>
        <Button disabled={pending} intent="secondary" onClick={onRemove}>
          Olib tashlash
        </Button>
      </div>
    </Card>
  );
}

function EmptyBookmarks({ label }: { label: string }) {
  return (
    <Card className="border-dashed py-8 text-center" elevation="none">
      <div aria-hidden="true" className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-neutral-bg text-neutral-text">
        ☆
      </div>
      <p className="mt-3 text-body-sm text-text-secondary">Saqlangan {label} yo‘q.</p>
    </Card>
  );
}

export default function StudentBookmarksPage() {
  const bookmarks = useBookmarks();

  if (bookmarks.query.isPending) {
    return <p className="rounded-xl border border-border-decorative bg-surface p-6 text-body-sm text-text-secondary" role="status">Saqlanganlar yuklanmoqda…</p>;
  }

  if (bookmarks.query.isError) {
    return (
      <Card className="border-danger-border bg-danger-bg" role="alert">
        <h1 className="type-heading-3 text-danger-text">Saqlanganlarni yuklab bo‘lmadi</h1>
        <p className="mt-2 text-body-sm text-danger-text">Internetni tekshirib, qayta urinib ko‘ring.</p>
        <Button className="mt-4" intent="secondary" onClick={() => void bookmarks.query.refetch()}>Qayta urinish</Button>
      </Card>
    );
  }

  const lessons = bookmarks.query.data?.filter((item) => item.kind === 'LESSON') ?? [];
  const vocabulary = bookmarks.query.data?.filter((item) => item.kind === 'VOCABULARY') ?? [];

  return (
    <>
      <header className="max-w-reading">
        <p className="text-label-md font-semibold uppercase tracking-[0.12em] text-brand-text">Talaba</p>
        <h1 className="mt-2 type-heading-1">Saqlanganlar</h1>
        <p className="mt-3 text-body-md text-text-secondary">Muhim dars va lug‘at yozuvlaringizni bir joyda saqlang.</p>
      </header>

      <section aria-labelledby="saved-lessons" className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="type-heading-2" id="saved-lessons">Darslar</h2>
            <p className="mt-1 text-body-sm text-text-secondary">Keyinroq davom ettirmoqchi bo‘lgan darslaringiz.</p>
          </div>
          <span className="rounded-full bg-neutral-bg px-3 py-1 text-label-sm text-neutral-text">{lessons.length}</span>
        </div>
        {lessons.length ? <div className="mt-5 grid gap-4 md:grid-cols-2">{lessons.map((item) => <BookmarkCard item={item} key={item.id} onRemove={() => bookmarks.remove.mutate(item.id)} pending={bookmarks.remove.isPending} />)}</div> : <div className="mt-5"><EmptyBookmarks label="darslar" /></div>}
      </section>

      <section aria-labelledby="saved-vocabulary" className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="type-heading-2" id="saved-vocabulary">Lug‘atlar</h2>
            <p className="mt-1 text-body-sm text-text-secondary">Yodlab olish uchun ajratib qo‘yilgan so‘zlar.</p>
          </div>
          <span className="rounded-full bg-neutral-bg px-3 py-1 text-label-sm text-neutral-text">{vocabulary.length}</span>
        </div>
        {vocabulary.length ? <div className="mt-5 grid gap-4 md:grid-cols-2">{vocabulary.map((item) => <BookmarkCard item={item} key={item.id} onRemove={() => bookmarks.remove.mutate(item.id)} pending={bookmarks.remove.isPending} />)}</div> : <div className="mt-5"><EmptyBookmarks label="lug‘atlar" /></div>}
      </section>
    </>
  );
}
