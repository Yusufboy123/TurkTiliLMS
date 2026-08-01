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

  return (
    <div
      aria-label={authMessages.session.actions}
      className={classNames('flex flex-wrap justify-end gap-2', className)}
      role="group"
    >
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
