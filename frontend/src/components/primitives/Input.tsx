import { forwardRef, type InputHTMLAttributes } from 'react';
import { classNames } from '../../lib/class-names';
import { useFormControlAccessibilityProps } from './form-field-context';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const controlBaseClasses =
  'min-h-target w-full rounded-md border border-border-control bg-surface px-3 py-2 text-body-md text-text-primary shadow-subtle transition-colors duration-fast placeholder:text-placeholder hover:border-border-control-hover focus:border-border-control-focus focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2 focus:ring-offset-surface disabled:cursor-not-allowed disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-disabled-text read-only:bg-subtle aria-[invalid=true]:border-danger-text aria-[invalid=true]:focus:ring-danger-text';

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    className,
    id,
    required,
    ...props
  },
  ref,
) {
  const accessibilityProps = useFormControlAccessibilityProps({
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    id,
    required,
  });

  return (
    <input
      {...props}
      {...accessibilityProps}
      className={classNames(controlBaseClasses, className)}
      ref={ref}
    />
  );
});
