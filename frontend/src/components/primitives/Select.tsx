import { forwardRef, type SelectHTMLAttributes } from 'react';
import { classNames } from '../../lib/class-names';
import { useFormControlAccessibilityProps } from './form-field-context';
import { controlBaseClasses } from './Input';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    children,
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
    <select
      {...props}
      {...accessibilityProps}
      className={classNames(controlBaseClasses, className)}
      ref={ref}
    >
      {children}
    </select>
  );
});
