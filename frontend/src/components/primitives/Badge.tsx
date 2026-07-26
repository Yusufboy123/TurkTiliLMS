import { type HTMLAttributes } from 'react';
import { classNames } from '../../lib/class-names';

export type BadgeIntent = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  intent?: BadgeIntent;
}

const intentClasses: Record<BadgeIntent, string> = {
  neutral: 'border-neutral-border bg-neutral-bg text-neutral-text',
  success: 'border-success-border bg-success-bg text-success-text',
  warning: 'border-warning-border bg-warning-bg text-warning-text',
  danger: 'border-danger-border bg-danger-bg text-danger-text',
  info: 'border-info-border bg-info-bg text-info-text',
};

export function Badge({ className, intent = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={classNames(
        'inline-flex min-h-6 items-center rounded-sm border px-2 py-1 text-label-sm',
        intentClasses[intent],
        className,
      )}
    />
  );
}
