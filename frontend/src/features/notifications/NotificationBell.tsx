import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card } from '../../components';
import { useNotifications } from './notifications.hooks';

function safeTarget(targetUrl: string | null) {
  return targetUrl && targetUrl.startsWith('/') && !targetUrl.startsWith('//') && !targetUrl.includes('\\') ? targetUrl : null;
}

function InteractiveNotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { query, markRead, markAllRead } = useNotifications(true);
  const data = query.data;
  return (
    <div className="relative">
      <Button aria-expanded={open} aria-haspopup="dialog" aria-label="Bildirishnomalar" intent="secondary" onClick={() => setOpen((value) => !value)} size="sm">
        <span aria-hidden="true">🔔</span>
        {data?.unreadCount ? <Badge intent="danger">{data.unreadCount > 99 ? '99+' : data.unreadCount}</Badge> : null}
      </Button>
      {open ? (
        <Card aria-label="Bildirishnomalar ro‘yxati" className="absolute right-0 z-dropdown mt-2 w-[min(22rem,calc(100vw-2rem))] p-3 shadow-floating" role="dialog">
          <div className="flex items-center justify-between gap-2"><h2 className="text-label-md">Bildirishnomalar</h2><Button disabled={!data?.unreadCount || markAllRead.isPending} intent="tertiary" onClick={() => markAllRead.mutate()} size="sm">Barchasini o‘qish</Button></div>
          {query.isPending ? <p className="mt-3 text-body-sm text-text-secondary" role="status">Yuklanmoqda…</p> : null}
          {query.isError ? <p className="mt-3 text-body-sm text-danger-text" role="alert">Bildirishnomalarni yuklab bo‘lmadi.</p> : null}
          {data?.items.length === 0 ? <p className="mt-3 text-body-sm text-text-secondary">Hozircha bildirishnoma yo‘q.</p> : null}
          <div className="mt-3 grid max-h-80 gap-2 overflow-y-auto">{data?.items.map((item) => { const target = safeTarget(item.targetUrl); return <button className={`rounded-lg border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${item.readAt ? 'border-border-decorative bg-surface' : 'border-brand-border bg-brand-soft'}`} key={item.id} onClick={() => { if (!item.readAt) markRead.mutate(item.id); if (target) navigate(target); setOpen(false); }} type="button"><p className="font-semibold">{item.title}</p><p className="mt-1 text-body-sm text-text-secondary">{item.message}</p><time className="mt-2 block text-caption text-text-muted" dateTime={item.createdAt}>{new Intl.DateTimeFormat('uz-Latn-UZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))}</time></button>; })}</div>
        </Card>
      ) : null}
    </div>
  );
}

export function NotificationBell() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <InteractiveNotificationBell /> : null;
}
