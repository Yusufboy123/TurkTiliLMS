import type { RoleCode, UserStatus } from '@prisma/client';

export interface UserCredentialRecord {
  passwordHash: string;
  failedLoginCount: number;
  lockedUntil: Date | null;
  requiresPasswordChange: boolean;
}

export interface UserAccessRecord {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: UserStatus;
  deletedAt: Date | null;
  lastLoginAt: Date | null;
  credential: UserCredentialRecord | null;
  roles: RoleCode[];
  permissions: string[];
}

export type UserAuthorizationRecord = Omit<UserAccessRecord, 'credential'>;

export interface SafeUserProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: UserStatus;
  lastLoginAt: Date | null;
}
