import { apiClient } from '../../../lib/api-client';

export interface RegistrationInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  passwordConfirmation: string;
}

export const registrationApi = {
  async register(input: RegistrationInput): Promise<void> {
    await apiClient.post('/auth/register', input, {
      headers: { 'X-Auth-Transport': 'cookie' },
      skipAuthHeader: true,
      skipAuthRefresh: true,
    });
  },
};
