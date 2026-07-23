import type { RoleCode, SessionClientType } from '@prisma/client';

export interface AuthenticatedPrincipal {
  userId: string;
  sessionId: string;
  clientType: SessionClientType;
  roles: RoleCode[];
  permissions: string[];
}
