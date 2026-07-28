import { createHash, randomBytes } from 'node:crypto';

export interface StepUpCryptoService {
  generateSecret(): string;
  hash(secret: string): string;
}

export class NodeStepUpCryptoService implements StepUpCryptoService {
  generateSecret(): string {
    return randomBytes(32).toString('base64url');
  }

  hash(secret: string): string {
    return createHash('sha256').update(secret, 'utf8').digest('hex');
  }
}
