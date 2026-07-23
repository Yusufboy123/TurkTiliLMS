import { UserStatus, type PrismaClient } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import { mapUserAuthorization, userAuthorizationSelect } from '../users/user.repository.js';
import type { AuthenticatedPrincipal } from './authorization.types.js';

export interface AuthorizationRepository {
  findActivePrincipal(
    userId: string,
    sessionId: string,
    now: Date,
  ): Promise<AuthenticatedPrincipal | null>;
  touchSession(sessionId: string, now: Date): Promise<void>;
}

export class PrismaAuthorizationRepository implements AuthorizationRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async findActivePrincipal(
    userId: string,
    sessionId: string,
    now: Date,
  ): Promise<AuthenticatedPrincipal | null> {
    const session = await this.client.userSession.findFirst({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
        expiresAt: { gt: now },
        user: {
          status: UserStatus.ACTIVE,
          deletedAt: null,
        },
      },
      select: {
        id: true,
        clientType: true,
        user: {
          select: userAuthorizationSelect,
        },
      },
    });

    if (!session) {
      return null;
    }

    const user = mapUserAuthorization(session.user, now);

    return {
      userId: user.id,
      sessionId: session.id,
      clientType: session.clientType,
      roles: user.roles,
      permissions: user.permissions,
    };
  }

  async touchSession(sessionId: string, now: Date): Promise<void> {
    const touchThreshold = new Date(now.getTime() - 5 * 60_000);
    await this.client.userSession.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
        lastActivityAt: { lt: touchThreshold },
      },
      data: { lastActivityAt: now },
    });
  }
}
