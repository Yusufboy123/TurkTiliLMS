import axios from 'axios';
import { authMessages } from '../../../locales/uz-Latn/auth';
import type { RegistrationInput } from './registration.api';

export type RegistrationField = keyof RegistrationInput;
export type RegistrationFieldErrors = Partial<Record<RegistrationField, string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegistrationForm(values: RegistrationInput): RegistrationFieldErrors {
  const errors: RegistrationFieldErrors = {};
  if (!values.firstName.trim()) errors.firstName = authMessages.validation.nameRequired;
  else if (values.firstName.trim().length > 100)
    errors.firstName = authMessages.validation.nameTooLong;
  if (!values.lastName.trim()) errors.lastName = authMessages.validation.nameRequired;
  else if (values.lastName.trim().length > 100)
    errors.lastName = authMessages.validation.nameTooLong;
  const email = values.email.trim();
  if (!email) errors.email = authMessages.validation.emailRequired;
  else if (email.length > 254 || !emailPattern.test(email))
    errors.email = authMessages.validation.emailInvalid;
  if (!values.password) errors.password = authMessages.validation.passwordRequired;
  else if (
    values.password.length < 12 ||
    !/[a-z]/.test(values.password) ||
    !/[A-Z]/.test(values.password) ||
    !/\d/.test(values.password) ||
    !/[^A-Za-z0-9]/.test(values.password)
  )
    errors.password = authMessages.validation.passwordPolicy;
  else if (values.password.length > 128) errors.password = authMessages.validation.passwordTooLong;
  if (!values.passwordConfirmation)
    errors.passwordConfirmation = authMessages.validation.passwordConfirmationRequired;
  else if (values.password !== values.passwordConfirmation)
    errors.passwordConfirmation = authMessages.validation.passwordConfirmationMismatch;
  return errors;
}

export function hasRegistrationErrors(errors: RegistrationFieldErrors): boolean {
  return Object.values(errors).some(Boolean);
}

export function mapRegistrationFailure(error: unknown): string {
  if (axios.isAxiosError(error) && error.response?.status === 429)
    return authMessages.errors.rateLimited;
  if (!axios.isAxiosError(error) || !error.response) return authMessages.errors.network;
  if (error.response.status === 422) return authMessages.errors.validation;
  if (error.response.status >= 500) return authMessages.errors.server;
  return authMessages.errors.registration;
}
