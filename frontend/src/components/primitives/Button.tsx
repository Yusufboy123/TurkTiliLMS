import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { classNames } from '../../lib/class-names';
import { ButtonBase, type ButtonIntent, type ButtonSize } from './button-base';
import { SpinnerGlyph } from './SpinnerGlyph';

export type { ButtonIntent, ButtonSize } from './button-base';
export type ButtonWidth = 'auto' | 'full';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  endIcon?: ReactNode;
  intent?: ButtonIntent;
  loading?: boolean;
  size?: ButtonSize;
  startIcon?: ReactNode;
  width?: ButtonWidth;
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-target px-3 py-2',
  md: 'min-h-target px-4 py-3',
  lg: 'min-h-12 px-6 py-3',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    className,
    disabled = false,
    endIcon,
    intent = 'primary',
    loading = false,
    onClick,
    size = 'md',
    startIcon,
    type = 'button',
    width = 'auto',
    ...props
  },
  ref,
) {
  return (
    <ButtonBase
      {...props}
      className={classNames(
        'inline-flex min-w-target items-center justify-center gap-2 text-button',
        sizeClasses[size],
        width === 'full' && 'w-full',
        className,
      )}
      disabled={disabled}
      intent={intent}
      loading={loading}
      onClick={onClick}
      ref={ref}
      type={type}
    >
      {loading ? <SpinnerGlyph size="sm" /> : startIcon}
      <span>{children}</span>
      {!loading && endIcon}
    </ButtonBase>
  );
});
