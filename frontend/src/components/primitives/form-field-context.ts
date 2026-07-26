import { createContext, useContext, type AriaAttributes } from 'react';

export interface FormFieldContextValue {
  controlId: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
}

export const FormFieldContext = createContext<FormFieldContextValue | null>(null);

export function useFormField(): FormFieldContextValue | null {
  return useContext(FormFieldContext);
}

export interface FormControlAccessibilityProps {
  'aria-describedby'?: string;
  'aria-invalid'?: AriaAttributes['aria-invalid'];
  id?: string;
  required?: boolean;
}

export function useFormControlAccessibilityProps({
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  id,
  required,
}: FormControlAccessibilityProps): FormControlAccessibilityProps {
  const field = useFormField();

  return {
    'aria-describedby': ariaDescribedBy ?? field?.describedBy,
    'aria-invalid': ariaInvalid ?? (field?.invalid || undefined),
    id: id ?? field?.controlId,
    required: required ?? field?.required,
  };
}
