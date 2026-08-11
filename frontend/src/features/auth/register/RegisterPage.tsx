import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, ErrorSummary, FormField, Input, SkipLink } from '../../../components';
import { authMessages } from '../../../locales/uz-Latn/auth';
import { registrationApi, type RegistrationInput } from './registration.api';
import {
  hasRegistrationErrors,
  mapRegistrationFailure,
  validateRegistrationForm,
  type RegistrationFieldErrors,
} from './registration-form.model';

const emptyValues: RegistrationInput = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  passwordConfirmation: '',
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState(emptyValues);
  const [errors, setErrors] = useState<RegistrationFieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasRegistrationErrors(errors) || failure) summaryRef.current?.focus();
  }, [errors, failure]);

  const update = (field: keyof RegistrationInput, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFailure(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const nextErrors = validateRegistrationForm(values);
    setErrors(nextErrors);
    setFailure(null);
    if (hasRegistrationErrors(nextErrors)) return;
    setPending(true);
    try {
      await registrationApi.register({
        ...values,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim().toLocaleLowerCase('en-US'),
      });
      setSuccess(true);
      window.setTimeout(() => navigate('/login?registered=1', { replace: true }), 900);
    } catch (error: unknown) {
      setFailure(mapRegistrationFailure(error));
      setPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-text-primary">
      <SkipLink targetId="main-content" />
      <header className="border-b border-border-decorative/80 bg-surface/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-marketing items-center px-4 md:px-6 lg:px-8">
          <Link
            className="flex min-h-target items-center gap-3 rounded-lg text-heading-4 font-semibold text-text-primary no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            to="/"
          >
            <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-lg bg-action-primary-bg text-button text-action-primary-text shadow-subtle">T</span>
            {authMessages.brand.name}
          </Link>
        </div>
      </header>
      <main
        className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-[30rem] content-center px-4 py-10"
        id="main-content"
        tabIndex={-1}
      >
        <Card className="relative overflow-hidden" padding="lg">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-action-primary-bg" />
          <h1 className="type-heading-1">{authMessages.registration.title}</h1>
          <p className="mt-3 text-body-md text-text-secondary">
            {authMessages.registration.description}
          </p>
          {success ? (
            <p
              className="mt-5 rounded-md border border-success-border bg-success-bg p-3 text-body-sm text-success-text"
              role="status"
            >
              {authMessages.registration.success}
            </p>
          ) : null}
          <form className="mt-6 grid gap-5" noValidate onSubmit={(event) => void submit(event)}>
            <ErrorSummary
              items={Object.entries(errors)
                .filter(([, message]) => Boolean(message))
                .map(([field, message]) => ({
                  message: message as string,
                  targetId: `register-${field}`,
                }))}
              ref={summaryRef}
              title={authMessages.validation.summary}
            />
            <FormField
              controlId="register-firstName"
              error={errors.firstName}
              label={authMessages.registration.firstName}
              required
            >
              <Input
                autoComplete="given-name"
                disabled={pending}
                id="register-firstName"
                onChange={(event) => update('firstName', event.target.value)}
                value={values.firstName}
              />
            </FormField>
            <FormField
              controlId="register-lastName"
              error={errors.lastName}
              label={authMessages.registration.lastName}
              required
            >
              <Input
                autoComplete="family-name"
                disabled={pending}
                id="register-lastName"
                onChange={(event) => update('lastName', event.target.value)}
                value={values.lastName}
              />
            </FormField>
            <FormField
              controlId="register-email"
              error={errors.email}
              label={authMessages.registration.email}
              required
            >
              <Input
                autoCapitalize="none"
                autoComplete="email"
                disabled={pending}
                id="register-email"
                inputMode="email"
                onChange={(event) => update('email', event.target.value)}
                spellCheck={false}
                type="email"
                value={values.email}
              />
            </FormField>
            <FormField
              controlId="register-password"
              description={authMessages.validation.passwordPolicy}
              error={errors.password}
              label={authMessages.registration.password}
              required
            >
              <Input
                autoComplete="new-password"
                disabled={pending}
                id="register-password"
                onChange={(event) => update('password', event.target.value)}
                type="password"
                value={values.password}
              />
            </FormField>
            <FormField
              controlId="register-passwordConfirmation"
              error={errors.passwordConfirmation}
              label={authMessages.registration.passwordConfirmation}
              required
            >
              <Input
                autoComplete="new-password"
                disabled={pending}
                id="register-passwordConfirmation"
                onChange={(event) => update('passwordConfirmation', event.target.value)}
                type="password"
                value={values.passwordConfirmation}
              />
            </FormField>
            <Button loading={pending} type="submit" width="full">
              {authMessages.registration.submit}
            </Button>
          </form>
          <p className="mt-6 border-t border-border-decorative pt-5 text-body-sm text-text-secondary">
            {authMessages.registration.alreadyHaveAccount}{' '}
            <Link to="/login">{authMessages.registration.loginLink}</Link>
          </p>
        </Card>
      </main>
    </div>
  );
}
