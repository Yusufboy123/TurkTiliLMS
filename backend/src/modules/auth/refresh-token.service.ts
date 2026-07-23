import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { RefreshTokenService } from './auth.types.js';

export class CryptoRefreshTokenService implements RefreshTokenService {
  generate(): string {
    return randomBytes(48).toString('base64url');
  }

  hash(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  createFamilyId(): string {
    return randomUUID();
  }
}
