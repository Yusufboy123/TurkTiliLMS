import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { classNames } from '../../../lib/class-names';

interface ProgressActionLinkProps {
  children: ReactNode;
  className?: string;
  to: string;
}

export function ProgressActionLink({ children, className, to }: ProgressActionLinkProps) {
  return (
    <Link
      className={classNames(
        'inline-flex min-h-target items-center justify-center rounded-lg border border-action-primary-border bg-action-primary-bg px-4 py-3 text-button text-action-primary-text no-underline transition-colors duration-fast visited:text-action-primary-text hover:bg-action-primary-hover-bg active:bg-action-primary-active-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        className,
      )}
      to={to}
    >
      {children}
    </Link>
  );
}
