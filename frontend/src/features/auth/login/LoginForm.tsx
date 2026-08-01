import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../auth-context';
import { LoginFormView } from './LoginFormView';
import {
  hasLoginFieldErrors,
  mapLoginFailure,
  normalizeLoginEmail,
  validateLoginForm,
  type LoginFailure,
  type LoginFieldErrors,
  type LoginFormValues,
} from './login-form.model';

const emptyValues: LoginFormValues = { email: '', password: '' };

export function LoginForm() {
  const auth = useAuth();
  const [values, setValues] = useState(emptyValues);
  const [errors, setErrors] = useState<LoginFieldErrors>({});
  const [submissionFailure, setSubmissionFailure] = useState<LoginFailure | null>(null);
  const [pending, setPending] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [capsLockEnabled, setCapsLockEnabled] = useState(false);
  const pendingRef = useRef(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasLoginFieldErrors(errors) || submissionFailure) summaryRef.current?.focus();
  }, [errors, submissionFailure]);

  const updateValue = (field: keyof LoginFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmissionFailure(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pendingRef.current) return;

    const nextErrors = validateLoginForm(values);
    setErrors(nextErrors);
    setSubmissionFailure(null);
    if (hasLoginFieldErrors(nextErrors)) return;

    pendingRef.current = true;
    setPending(true);
    try {
      await auth.login({
        clientType: 'WEB',
        email: normalizeLoginEmail(values.email),
        password: values.password,
      });
    } catch (error: unknown) {
      const failure = mapLoginFailure(error);
      if (failure.clearPassword) {
        setValues((current) => ({ ...current, password: '' }));
        setPasswordVisible(false);
      }
      setSubmissionFailure(failure);
      pendingRef.current = false;
      setPending(false);
    }
  };

  return (
    <LoginFormView
      capsLockEnabled={capsLockEnabled}
      errors={errors}
      onCapsLockChange={setCapsLockEnabled}
      onChange={updateValue}
      onPasswordVisibilityChange={() => setPasswordVisible((visible) => !visible)}
      onSubmit={(event) => void submit(event)}
      passwordVisible={passwordVisible}
      pending={pending}
      submissionFailure={submissionFailure}
      summaryRef={summaryRef}
      values={values}
    />
  );
}
