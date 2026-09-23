import axios from 'axios';
import { authMessages } from '../../../locales/uz-Latn/auth';

export interface LoginFormValues {
  email: string;
  password: string;
}

export interface LoginFieldErrors {
  email?: string;
  password?: string;
}

export interface LoginFailure {
  clearPassword: boolean;
  help?: string;
  message: string;
}

interface ApiErrorEnvelope {
  code?: unknown;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const classroomUsernamePattern = /^[a-z0-9][a-z0-9._-]{2,31}$/;
export const classroomMode = import.meta.env.VITE_CLASSROOM_MODE === 'true';

export function validateLoginForm(values: LoginFormValues): LoginFieldErrors {
  const errors: LoginFieldErrors = {};
  const email = values.email.trim();

  if (!email) errors.email = classroomMode ? authMessages.validation.usernameRequired : authMessages.validation.emailRequired;
  else if (classroomMode ? !classroomUsernamePattern.test(email.toLocaleLowerCase('en-US')) : email.length > 254 || !emailPattern.test(email)) {
    errors.email = classroomMode ? authMessages.validation.usernameInvalid : authMessages.validation.emailInvalid;
  }

  if (!values.password) errors.password = authMessages.validation.passwordRequired;
  else if (values.password.length > 128) {
    errors.password = authMessages.validation.passwordTooLong;
  }

  return errors;
}

export function hasLoginFieldErrors(errors: LoginFieldErrors): boolean {
  return Boolean(errors.email || errors.password);
}

export function normalizeLoginEmail(email: string): string {
  const normalized = email.trim().toLocaleLowerCase('en-US');
  return classroomMode ? `${normalized}@classroom.local` : normalized;
}

export function mapLoginFailure(error: unknown): LoginFailure {
  if (!axios.isAxiosError<ApiErrorEnvelope>(error)) {
    return { clearPassword: false, message: authMessages.errors.unknown };
  }

  if (!error.response) {
    return { clearPassword: false, message: authMessages.errors.network };
  }

  const code = error.response.data?.code;
  if (error.response.status === 401 && code === 'INVALID_CREDENTIALS') {
    return {
      clearPassword: true,
      help: authMessages.errors.inactiveAccountHelp,
      message: authMessages.errors.invalidCredentials,
    };
  }
  if (error.response.status === 422 || code === 'VALIDATION_ERROR') {
    return { clearPassword: true, message: authMessages.errors.validation };
  }
  if (
    error.response.status === 429 ||
    code === 'AUTH_RATE_LIMITED' ||
    code === 'RATE_LIMIT_EXCEEDED'
  ) {
    return { clearPassword: true, message: authMessages.errors.rateLimited };
  }
  if (error.response.status >= 500) {
    return { clearPassword: false, message: authMessages.errors.server };
  }

  return { clearPassword: false, message: authMessages.errors.unknown };
}
