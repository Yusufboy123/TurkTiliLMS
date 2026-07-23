import type { RoleCode, SessionClientType } from '@prisma/client';
import type { SafeUserProfile } from '../users/user.types.js';

export interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
  deviceName?: string;
  clientType: SessionClientType;
}

export interface AccessTokenClaims {
  sub: string;
  sessionId: string;
  roles: RoleCode[];
}

export interface AuthSessionRecord {
  id: string;
  userId: string;
  tokenFamilyId: string;
  clientType: SessionClientType;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedBySessionId: string | null;
}

export interface AuthenticationResult {
  accessToken: string;
  refreshToken: string;
  user: SafeUserProfile;
  roles: RoleCode[];
  permissions: string[];
}

export interface AccessTokenService {
  sign(claims: AccessTokenClaims): string;
  verify(token: string): AccessTokenClaims;
}

export interface PasswordService {
  hash(password: string): Promise<string>;
  verify(password: string, passwordHash: string): Promise<boolean>;
  verifyAgainstDummyHash(password: string): Promise<void>;
}

export interface RefreshTokenService {
  generate(): string;
  hash(token: string): string;
  createFamilyId(): string;
}
