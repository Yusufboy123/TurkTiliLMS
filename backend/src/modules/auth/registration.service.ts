import type { PasswordService } from './auth.types.js';
import type { RegistrationInput } from './auth.schemas.js';
import type { RegistrationRepository } from './registration.repository.js';

export interface RegistrationResult {
  created: boolean;
}

export class RegistrationService {
  constructor(
    private readonly repository: RegistrationRepository,
    private readonly passwords: PasswordService,
  ) {}

  async register(input: RegistrationInput): Promise<RegistrationResult> {
    const passwordHash = await this.passwords.hash(input.password);
    const created = await this.repository.createStudent({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      passwordHash,
    });
    return { created };
  }
}
