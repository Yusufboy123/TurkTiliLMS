import { useRef, useState } from 'react';
import { Button } from '../../../components';
import { classNames } from '../../../lib/class-names';
import { authMessages } from '../../../locales/uz-Latn/auth';
import { useAuth } from '../auth-context';

export interface SessionActionsProps {
  className?: string;
}

export function SessionActions({ className }: SessionActionsProps) {
  const auth = useAuth();
  const [pendingAction, setPendingAction] = useState<'logout' | 'logout-all' | null>(null);
  const pendingRef = useRef(false);

  const run = async (action: 'logout' | 'logout-all') => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPendingAction(action);

    try {
      if (action === 'logout') await auth.logout();
      else await auth.logoutAll();
    } finally {
      pendingRef.current = false;
      setPendingAction(null);
    }
  };

  const displayName = auth.status === 'authenticated'
    ? [auth.user.firstName, auth.user.lastName].filter(Boolean).join(' ') || auth.user.email
    : null;
  const initials = displayName?.slice(0, 1).toUpperCase() ?? 'T';

  return (
    <div
      aria-label={authMessages.session.actions}
      className={classNames('flex flex-wrap items-center justify-end gap-3', className)}
      role="group"
    >
      {displayName ? (
        <div className="mr-auto flex min-w-0 items-center gap-3 rounded-xl border border-border-decorative bg-surface px-3 py-2 shadow-subtle">
          <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-nav-selected-bg text-label-md text-nav-selected-text">
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-label-md text-text-primary">{displayName}</p>
            {auth.status === 'authenticated' && displayName !== auth.user.email ? <p className="truncate text-caption text-text-muted">{auth.user.email}</p> : null}
          </div>
        </div>
      ) : null}
      <Button
        disabled={pendingAction !== null}
        intent="secondary"
        loading={pendingAction === 'logout'}
        onClick={() => void run('logout').catch(() => undefined)}
        size="sm"
      >
        {authMessages.session.logout}
      </Button>
      <Button
        disabled={pendingAction !== null}
        intent="tertiary"
        loading={pendingAction === 'logout-all'}
        onClick={() => void run('logout-all').catch(() => undefined)}
        size="sm"
      >
        {authMessages.session.logoutAll}
      </Button>
    </div>
  );
}
