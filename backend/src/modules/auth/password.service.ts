import bcrypt from 'bcrypt';
import type { PasswordService } from './auth.types.js';

export class BcryptPasswordService implements PasswordService {
  private dummyHashPromise?: Promise<string>;

  constructor(private readonly rounds: number) {}

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.rounds);
  }

  verify(password: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
  }

  async verifyAgainstDummyHash(password: string): Promise<void> {
    this.dummyHashPromise ??= bcrypt.hash('timing-protection-only', this.rounds);
    const dummyHash = await this.dummyHashPromise;
    await bcrypt.compare(password, dummyHash);
  }
}
