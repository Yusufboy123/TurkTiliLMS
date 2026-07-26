import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { classNames } from '../../lib/class-names';
import { useFormControlAccessibilityProps } from './form-field-context';
import { controlBaseClasses } from './Input';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    className,
    id,
    required,
    rows = 4,
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
    <textarea
      {...props}
      {...accessibilityProps}
      className={classNames(controlBaseClasses, 'resize-y', className)}
      ref={ref}
      rows={rows}
    />
  );
});
