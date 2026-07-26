import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { classNames } from '../../lib/class-names';
import { Portal } from '../overlays/Portal';
import { Button } from '../primitives/Button';
import { IconButton } from '../primitives/IconButton';
import { ToastContext, type ToastAction, type ToastInput, type ToastIntent } from './toast-context';

interface ToastRecord extends Required<Pick<ToastInput, 'durationMs' | 'intent'>> {
  action?: ToastAction;
  id: string;
  message: string;
  title?: string;
}

const intentClasses: Record<ToastIntent, string> = {
  neutral: 'border-neutral-border bg-neutral-bg text-neutral-text',
  success: 'border-success-border bg-success-bg text-success-text',
  warning: 'border-warning-border bg-warning-bg text-warning-text',
  danger: 'border-danger-border bg-danger-bg text-danger-text',
  info: 'border-info-border bg-info-bg text-info-text',
};

export interface ToastProviderProps {
  children: ReactNode;
  maxVisible?: number;
}

function ToastItem({ dismiss, toast }: { dismiss: (id: string) => void; toast: ToastRecord }) {
  const timeoutRef = useRef<number | null>(null);
  const remainingRef = useRef(toast.durationMs);
  const startedAtRef = useRef(0);

  const stopTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      remainingRef.current = Math.max(
        0,
        remainingRef.current - (Date.now() - startedAtRef.current),
      );
      timeoutRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    if (toast.durationMs <= 0 || timeoutRef.current !== null) {
      return;
    }
    startedAtRef.current = Date.now();
    timeoutRef.current = window.setTimeout(() => dismiss(toast.id), remainingRef.current);
  }, [dismiss, toast.durationMs, toast.id]);

  useEffect(() => {
    startTimer();
    return stopTimer;
  }, [startTimer, stopTimer]);

  return (
    <div
      className={classNames(
        'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border p-4 shadow-dropdown',
        intentClasses[toast.intent],
      )}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          startTimer();
        }
      }}
      onFocus={stopTimer}
      onMouseEnter={stopTimer}
      onMouseLeave={startTimer}
    >
      <div className="min-w-0 flex-1">
        {toast.title ? <p className="text-label-md">{toast.title}</p> : null}
        <p className={classNames('text-body-sm', toast.title && 'mt-1')}>{toast.message}</p>
        {toast.action ? (
          <Button
            className="mt-2 underline underline-offset-2"
            intent="tertiary"
            onClick={() => {
              toast.action?.onClick();
              dismiss(toast.id);
            }}
            size="sm"
            type="button"
          >
            {toast.action.label}
          </Button>
        ) : null}
      </div>
      <IconButton
        aria-label="Xabarni yopish"
        className="h-11 w-11"
        icon={<span aria-hidden="true">×</span>}
        intent="tertiary"
        onClick={() => dismiss(toast.id)}
        size="sm"
      />
    </div>
  );
}

export function ToastProvider({ children, maxVisible = 3 }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (input: ToastInput) => {
      const id = crypto.randomUUID();
      const record: ToastRecord = {
        ...input,
        durationMs: input.durationMs ?? 5000,
        id,
        intent: input.intent ?? 'neutral',
      };
      setToasts((current) => [...current, record].slice(-maxVisible));
      return id;
    },
    [maxVisible],
  );

  const value = useMemo(() => ({ dismiss, show }), [dismiss, show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <Portal>
        <div className="pointer-events-none fixed inset-x-4 top-4 z-toast flex flex-col items-end gap-3">
          <div aria-atomic="false" aria-live="polite" className="contents">
            {toasts
              .filter((toast) => toast.intent !== 'danger')
              .map((toast) => (
                <ToastItem dismiss={dismiss} key={toast.id} toast={toast} />
              ))}
          </div>
          <div aria-atomic="false" aria-live="assertive" className="contents">
            {toasts
              .filter((toast) => toast.intent === 'danger')
              .map((toast) => (
                <ToastItem dismiss={dismiss} key={toast.id} toast={toast} />
              ))}
          </div>
        </div>
      </Portal>
    </ToastContext.Provider>
  );
}
