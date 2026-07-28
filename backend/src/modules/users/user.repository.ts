import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { UserAccessRecord, UserAuthorizationRecord } from './user.types.js';

const baseUserAccessSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  status: true,
  deletedAt: true,
  lastLoginAt: true,
  roles: {
    select: {
      expiresAt: true,
      role: {
        select: {
          code: true,
          permissions: {
            select: {
              permission: {
                select: {
                  code: true,
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.UserSelect;

export const userAccessSelect = {
  ...baseUserAccessSelect,
  credential: {
    select: {
      passwordHash: true,
      passwordChangedAt: true,
      failedLoginCount: true,
      lockedUntil: true,
      requiresPasswordChange: true,
    },
  },
} satisfies Prisma.UserSelect;

type UserAccessPayload = Prisma.UserGetPayload<{ select: typeof userAccessSelect }>;
export const userAuthorizationSelect = baseUserAccessSelect;
type UserAuthorizationPayload = Prisma.UserGetPayload<{
  select: typeof userAuthorizationSelect;
}>;

function mapRolesAndPermissions(
  user: UserAuthorizationPayload,
  now: Date,
): Pick<UserAuthorizationRecord, 'roles' | 'permissions'> {
  const activeRoleAssignments = user.roles.filter(
    (assignment) => assignment.expiresAt === null || assignment.expiresAt > now,
  );
  const roles = [...new Set(activeRoleAssignments.map((assignment) => assignment.role.code))];
  const permissions = [
    ...new Set(
      activeRoleAssignments.flatMap((assignment) =>
        assignment.role.permissions.map((item) => item.permission.code),
      ),
    ),
  ];

  return { roles, permissions };
}

export function mapUserAuthorization(
  user: UserAuthorizationPayload,
  now = new Date(),
): UserAuthorizationRecord {
  const access = mapRolesAndPermissions(user, now);

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    status: user.status,
    deletedAt: user.deletedAt,
    lastLoginAt: user.lastLoginAt,
    ...access,
  };
}

export function mapUserAccess(user: UserAccessPayload, now = new Date()): UserAccessRecord {
  return {
    ...mapUserAuthorization(user, now),
    credential: user.credential,
  };
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserAccessRecord | null>;
  findById(userId: string): Promise<UserAccessRecord | null>;
}

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async findByEmail(email: string): Promise<UserAccessRecord | null> {
    const user = await this.client.user.findUnique({
      where: { email },
      select: userAccessSelect,
    });

    return user ? mapUserAccess(user) : null;
  }

  async findById(userId: string): Promise<UserAccessRecord | null> {
    const user = await this.client.user.findUnique({
      where: { id: userId },
      select: userAccessSelect,
    });

    return user ? mapUserAccess(user) : null;
  }
}
