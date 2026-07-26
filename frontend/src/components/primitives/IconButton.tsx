import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { classNames } from '../../lib/class-names';
import { ButtonBase, type ButtonIntent, type ButtonSize } from './button-base';
import { SpinnerGlyph } from './SpinnerGlyph';

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'children'
> {
  'aria-label': string;
  icon: ReactNode;
  intent?: ButtonIntent;
  loading?: boolean;
  size?: ButtonSize;
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-11 w-11',
  md: 'h-11 w-11',
  lg: 'h-12 w-12',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    'aria-label': ariaLabel,
    className,
    disabled = false,
    icon,
    intent = 'tertiary',
    loading = false,
    onClick,
    size = 'md',
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <ButtonBase
      {...props}
      aria-label={ariaLabel}
      className={classNames(
        'inline-grid shrink-0 place-items-center',
        sizeClasses[size],
        className,
      )}
      disabled={disabled}
      intent={intent}
      loading={loading}
      onClick={onClick}
      ref={ref}
      type={type}
    >
      {loading ? <SpinnerGlyph size="sm" /> : icon}
    </ButtonBase>
  );
});
