import { forwardRef, type HTMLAttributes } from 'react';
import { classNames } from '../../lib/class-names';

export interface ErrorSummaryItem {
  message: string;
  targetId?: string;
}

export interface ErrorSummaryProps extends HTMLAttributes<HTMLDivElement> {
  items: ErrorSummaryItem[];
  title: string;
}

export const ErrorSummary = forwardRef<HTMLDivElement, ErrorSummaryProps>(function ErrorSummary(
  { className, items, title, ...props },
  ref,
) {
  if (items.length === 0) return null;

  return (
    <div
      {...props}
      className={classNames(
        'rounded-md border border-danger-border bg-danger-bg p-4 text-danger-text focus:outline-none focus-visible:ring-2 focus-visible:ring-focus',
        className,
      )}
      ref={ref}
      role="alert"
      tabIndex={-1}
    >
      <h2 className="text-label-md">{title}</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-body-sm">
        {items.map((item, index) => (
          <li key={`${item.targetId ?? 'summary'}-${index}`}>
            {item.targetId ? (
              <a className="text-current underline" href={`#${item.targetId}`}>
                {item.message}
              </a>
            ) : (
              item.message
            )}
          </li>
        ))}
      </ul>
    </div>
  );
});
