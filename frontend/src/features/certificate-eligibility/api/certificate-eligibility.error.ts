import axios from 'axios';
import { certificateEligibilityMessages as messages } from '../../../locales/uz-Latn/certificate-eligibility';

export function certificateEligibilityErrorMessage(error: unknown): string {
  return axios.isAxiosError(error) && error.response?.status === 403
    ? messages.errors.permission
    : messages.errors.generic;
}
