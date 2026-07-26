import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { classNames } from '../../lib/class-names';

export type ButtonIntent = 'primary' | 'secondary' | 'tertiary' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const intentClasses: Record<ButtonIntent, string> = {
  primary:
    'border-action-primary-border bg-action-primary-bg text-action-primary-text hover:bg-action-primary-hover-bg active:bg-action-primary-active-bg',
  secondary:
    'border-action-secondary-border bg-action-secondary-bg text-action-secondary-text hover:bg-action-secondary-hover-bg active:bg-action-secondary-active-bg',
  tertiary:
    'border-action-tertiary-border bg-action-tertiary-bg text-action-tertiary-text hover:bg-action-tertiary-hover-bg active:bg-action-tertiary-active-bg',
  danger:
    'border-action-danger-border bg-action-danger-bg text-action-danger-text hover:bg-action-danger-hover-bg active:bg-action-danger-active-bg',
};

const sharedButtonClasses =
  'rounded-lg border transition-colors duration-fast focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:border-action-disabled-border disabled:bg-action-disabled-bg disabled:text-action-disabled-text';

export interface ButtonBaseProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  intent?: ButtonIntent;
  loading?: boolean;
}

export const ButtonBase = forwardRef<HTMLButtonElement, ButtonBaseProps>(function ButtonBase(
  {
    children,
    className,
    disabled = false,
    intent = 'primary',
    loading = false,
    onClick,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <button
      {...props}
      aria-busy={loading || undefined}
      aria-disabled={loading || disabled || undefined}
      className={classNames(
        sharedButtonClasses,
        intentClasses[intent],
        loading && 'cursor-wait',
        className,
      )}
      data-loading={loading || undefined}
      disabled={disabled}
      onClick={(event) => {
        if (loading) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onClick?.(event);
      }}
      ref={ref}
      type={type}
    >
      {children}
    </button>
  );
});
