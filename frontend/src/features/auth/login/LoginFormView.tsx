import type { ChangeEvent, FormEvent, KeyboardEvent, RefObject } from 'react';
import { Button, ErrorSummary, FormField, Input } from '../../../components';
import { authMessages } from '../../../locales/uz-Latn/auth';
import type { LoginFailure, LoginFieldErrors, LoginFormValues } from './login-form.model';

export interface LoginFormViewProps {
  capsLockEnabled: boolean;
  errors: LoginFieldErrors;
  onCapsLockChange(enabled: boolean): void;
  onChange(field: keyof LoginFormValues, value: string): void;
  onPasswordVisibilityChange(): void;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  passwordVisible: boolean;
  pending: boolean;
  submissionFailure: LoginFailure | null;
  summaryRef: RefObject<HTMLDivElement | null>;
  values: LoginFormValues;
}

function capsLockState(event: KeyboardEvent<HTMLInputElement>): boolean {
  return event.getModifierState('CapsLock');
}

export function LoginFormView({
  capsLockEnabled,
  errors,
  onCapsLockChange,
  onChange,
  onPasswordVisibilityChange,
  onSubmit,
  passwordVisible,
  pending,
  submissionFailure,
  summaryRef,
  values,
}: LoginFormViewProps) {
  const summaryItems = [
    ...(errors.email ? [{ message: errors.email, targetId: 'login-email' }] : []),
    ...(errors.password ? [{ message: errors.password, targetId: 'login-password' }] : []),
    ...(submissionFailure ? [{ message: submissionFailure.message }] : []),
  ];

  const change = (field: keyof LoginFormValues) => (event: ChangeEvent<HTMLInputElement>) =>
    onChange(field, event.target.value);

  return (
    <form className="grid gap-5" noValidate onSubmit={onSubmit}>
      <ErrorSummary items={summaryItems} ref={summaryRef} title={authMessages.validation.summary} />

      <FormField
        controlId="login-email"
        error={errors.email}
        label={authMessages.login.email}
        required
      >
        <Input
          autoCapitalize="none"
          autoComplete="email"
          autoFocus
          disabled={pending}
          inputMode="email"
          name="email"
          onChange={change('email')}
          spellCheck={false}
          type="email"
          value={values.email}
        />
      </FormField>

      <FormField
        controlId="login-password"
        description={capsLockEnabled ? authMessages.login.capsLock : undefined}
        error={errors.password}
        label={authMessages.login.password}
        required
      >
        <Input
          autoComplete="current-password"
          disabled={pending}
          name="password"
          onBlur={() => onCapsLockChange(false)}
          onChange={change('password')}
          onKeyDown={(event) => onCapsLockChange(capsLockState(event))}
          onKeyUp={(event) => onCapsLockChange(capsLockState(event))}
          type={passwordVisible ? 'text' : 'password'}
          value={values.password}
        />
        <Button
          aria-pressed={passwordVisible}
          disabled={pending}
          intent="tertiary"
          onClick={onPasswordVisibilityChange}
          size="sm"
        >
          {passwordVisible ? authMessages.login.hidePassword : authMessages.login.showPassword}
        </Button>
      </FormField>

      {submissionFailure?.help ? (
        <p className="text-body-sm text-text-secondary">{submissionFailure.help}</p>
      ) : null}

      <Button loading={pending} type="submit" width="full">
        {authMessages.login.submit}
      </Button>
    </form>
  );
}
