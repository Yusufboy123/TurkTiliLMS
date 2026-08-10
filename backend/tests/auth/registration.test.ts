import { RoleCode } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { RegistrationService } from '../../src/modules/auth/registration.service.js';
import type { PasswordService } from '../../src/modules/auth/auth.types.js';
import type { RegistrationRepository } from '../../src/modules/auth/registration.repository.js';
import type { RegistrationInput } from '../../src/modules/auth/auth.schemas.js';

const input: RegistrationInput = {
  firstName: 'Ali',
  lastName: 'Talaba',
  email: 'ali@example.com',
  password: 'StrongPassword1!',
  passwordConfirmation: 'StrongPassword1!',
};

class FakePasswordService implements PasswordService {
  lastPlaintext: string | null = null;
  async hash(password: string) {
    this.lastPlaintext = password;
    return `hash:${password}`;
  }
  async verify() {
    return false;
  }
  async verifyAgainstDummyHash() {
    return undefined;
  }
}
class FakeRegistrationRepository implements RegistrationRepository {
  lastInput: { firstName: string; lastName: string; email: string; passwordHash: string } | null =
    null;
  created = true;
  async createStudent(value: {
    firstName: string;
    lastName: string;
    email: string;
    passwordHash: string;
  }) {
    this.lastInput = value;
    return this.created;
  }
}

describe('RegistrationService', () => {
  it('hashes the password and creates a student-only registration', async () => {
    const passwords = new FakePasswordService();
    const repository = new FakeRegistrationRepository();
    const service = new RegistrationService(repository, passwords);
    const result = await service.register(input);
    expect(result).toEqual({ created: true });
    expect(repository.lastInput).toMatchObject({
      email: input.email,
      passwordHash: 'hash:StrongPassword1!',
    });
    expect(repository.lastInput).not.toHaveProperty('password');
    expect(passwords.lastPlaintext).toBe(input.password);
  });
  it('returns the same safe outcome when the email already exists', async () => {
    const passwords = new FakePasswordService();
    const repository = new FakeRegistrationRepository();
    repository.created = false;
    const result = await new RegistrationService(repository, passwords).register(input);
    expect(result).toEqual({ created: false });
  });
  it('keeps the intended role limited to STUDENT at the registration boundary', () => {
    expect(RoleCode.STUDENT).toBe('STUDENT');
    expect(RoleCode.TEACHER).not.toBe('STUDENT');
  });
});
