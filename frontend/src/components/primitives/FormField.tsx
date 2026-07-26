import { useId, type HTMLAttributes, type ReactNode } from 'react';
import { classNames } from '../../lib/class-names';
import { FormFieldContext } from './form-field-context';

export interface FormFieldProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  controlId?: string;
  description?: ReactNode;
  error?: ReactNode;
  label: ReactNode;
  optionalLabel?: string;
  required?: boolean;
}

export function FormField({
  children,
  className,
  controlId: providedControlId,
  description,
  error,
  label,
  optionalLabel = 'Ixtiyoriy',
  required = false,
  ...props
}: FormFieldProps) {
  const generatedId = useId();
  const controlId = providedControlId ?? `field-${generatedId}`;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <FormFieldContext.Provider
      value={{ controlId, describedBy, invalid: Boolean(error), required }}
    >
      <div {...props} className={classNames('grid gap-2', className)}>
        <label className="text-label-md text-text-primary" htmlFor={controlId}>
          {label}
          {required ? (
            <>
              <span aria-hidden="true" className="text-danger-text">
                {' '}
                *
              </span>
              <span className="sr-only"> (majburiy)</span>
            </>
          ) : (
            <span className="ml-2 text-caption text-text-muted">({optionalLabel})</span>
          )}
        </label>
        {description ? (
          <p className="text-body-sm text-text-secondary" id={descriptionId}>
            {description}
          </p>
        ) : null}
        {children}
        {error ? (
          <p className="text-body-sm text-danger-text" id={errorId} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </FormFieldContext.Provider>
  );
}
