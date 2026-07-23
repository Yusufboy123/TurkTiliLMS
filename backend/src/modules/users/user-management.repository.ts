import {
  Prisma,
  RoleCode,
  UserStatus,
  type PrismaClient,
  type UserStatus as UserStatusValue,
} from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type {
  AuditContext,
  CreateUserData,
  UpdateUserData,
  UserDetailRecord,
  UserListQuery,
  UserManagementRecord,
  UserStatistics,
} from './user-management.types.js';

const managementUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  displayName: true,
  status: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  credential: {
    select: { userId: true },
  },
  roles: {
    select: {
      expiresAt: true,
      role: {
        select: { code: true },
      },
    },
  },
} satisfies Prisma.UserSelect;

type ManagementUserPayload = Prisma.UserGetPayload<{ select: typeof managementUserSelect }>;

export class UserEmailConflictError extends Error {
  constructor() {
    super('User email already exists.');
    this.name = 'UserEmailConflictError';
  }
}

export class RoleCatalogMismatchError extends Error {
  constructor() {
    super('One or more roles do not exist.');
    this.name = 'RoleCatalogMismatchError';
  }
}

export class LastActiveAdministratorError extends Error {
  constructor() {
    super('The final active administrator cannot be changed.');
    this.name = 'LastActiveAdministratorError';
  }
}

function activeRoles(user: ManagementUserPayload, now = new Date()): RoleCode[] {
  return [
    ...new Set(
      user.roles
        .filter((assignment) => assignment.expiresAt === null || assignment.expiresAt > now)
        .map((assignment) => assignment.role.code),
    ),
  ];
}

function mapManagementUser(user: ManagementUserPayload, now = new Date()): UserManagementRecord {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: user.displayName,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt,
    lastLoginAt: user.lastLoginAt,
    deletedAt: user.deletedAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    hasPassword: user.credential !== null,
    roles: activeRoles(user, now),
  };
}

function auditFields(context: AuditContext): {
  actorUserId: string;
  requestCorrelationId?: string;
  ipHash?: string;
  userAgentSummary?: string;
} {
  return {
    actorUserId: context.actorUserId,
    ...(context.requestCorrelationId ? { requestCorrelationId: context.requestCorrelationId } : {}),
    ...(context.ipHash ? { ipHash: context.ipHash } : {}),
    ...(context.userAgentSummary ? { userAgentSummary: context.userAgentSummary } : {}),
  };
}

function auditSummary(user: UserManagementRecord): Prisma.InputJsonObject {
  return {
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: user.displayName,
    status: user.status,
    deletedAt: user.deletedAt?.toISOString() ?? null,
    roles: user.roles,
  };
}

function buildUserWhere(query: UserListQuery): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};

  if (query.deleted === 'exclude') {
    where.deletedAt = null;
  } else if (query.deleted === 'only') {
    where.deletedAt = { not: null };
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.role) {
    where.roles = {
      some: {
        role: { code: query.role },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    };
  }

  if (query.search) {
    where.OR = [
      { email: { contains: query.search, mode: 'insensitive' } },
      { firstName: { contains: query.search, mode: 'insensitive' } },
      { lastName: { contains: query.search, mode: 'insensitive' } },
      { displayName: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  return where;
}

function buildUserOrderBy(query: UserListQuery): Prisma.UserOrderByWithRelationInput[] {
  const selectedOrder = { [query.sortBy]: query.sortDirection };
  return [selectedOrder, { id: query.sortDirection }];
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

async function rolesByCodes(
  transaction: Prisma.TransactionClient,
  roleCodes: RoleCode[],
): Promise<Array<{ id: string; code: RoleCode }>> {
  const roles = await transaction.role.findMany({
    where: { code: { in: roleCodes } },
    select: { id: true, code: true },
  });

  if (roles.length !== roleCodes.length) {
    throw new RoleCatalogMismatchError();
  }

  return roles;
}

async function assertAnotherActiveAdministrator(
  transaction: Prisma.TransactionClient,
  excludedUserId: string,
  now: Date,
): Promise<void> {
  const otherAdministratorCount = await transaction.user.count({
    where: {
      id: { not: excludedUserId },
      status: UserStatus.ACTIVE,
      deletedAt: null,
      roles: {
        some: {
          role: { code: RoleCode.ADMIN },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      },
    },
  });

  if (otherAdministratorCount === 0) {
    throw new LastActiveAdministratorError();
  }
}

export interface UserManagementRepository {
  list(query: UserListQuery): Promise<{ items: UserManagementRecord[]; total: number }>;
  findById(userId: string): Promise<UserDetailRecord | null>;
  create(data: CreateUserData, context: AuditContext): Promise<UserManagementRecord>;
  update(
    userId: string,
    data: UpdateUserData,
    context: AuditContext,
  ): Promise<UserManagementRecord | null>;
  updateStatus(
    userId: string,
    status: Exclude<UserStatusValue, 'DELETED'>,
    context: AuditContext,
  ): Promise<UserManagementRecord | null>;
  replaceRoles(
    userId: string,
    roles: RoleCode[],
    context: AuditContext,
  ): Promise<UserManagementRecord | null>;
  softDelete(userId: string, context: AuditContext): Promise<UserManagementRecord | null>;
  restore(userId: string, context: AuditContext): Promise<UserManagementRecord | null>;
  statistics(): Promise<UserStatistics>;
}

export class PrismaUserManagementRepository implements UserManagementRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async list(query: UserListQuery): Promise<{ items: UserManagementRecord[]; total: number }> {
    const where = buildUserWhere(query);
    const [users, total] = await this.client.$transaction([
      this.client.user.findMany({
        where,
        select: managementUserSelect,
        orderBy: buildUserOrderBy(query),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.client.user.count({ where }),
    ]);

    return {
      items: users.map((user) => mapManagementUser(user)),
      total,
    };
  }

  async findById(userId: string): Promise<UserDetailRecord | null> {
    const now = new Date();
    const [user, activeSessionCount] = await this.client.$transaction([
      this.client.user.findUnique({
        where: { id: userId },
        select: managementUserSelect,
      }),
      this.client.userSession.count({
        where: {
          userId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
      }),
    ]);

    return user ? { ...mapManagementUser(user, now), activeSessionCount } : null;
  }

  async create(data: CreateUserData, context: AuditContext): Promise<UserManagementRecord> {
    try {
      return await this.client.$transaction(
        async (transaction) => {
          const roles = await rolesByCodes(transaction, data.roles);
          const user = await transaction.user.create({
            data: {
              email: data.email,
              ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
              ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
              ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
              status: data.status,
              roles: {
                create: roles.map((role) => ({
                  roleId: role.id,
                  assignedByUserId: context.actorUserId,
                })),
              },
            },
            select: managementUserSelect,
          });
          const mappedUser = mapManagementUser(user);

          await transaction.auditLog.create({
            data: {
              ...auditFields(context),
              action: 'users.created',
              subjectType: 'user',
              subjectId: user.id,
              afterSummary: auditSummary(mappedUser),
            },
          });

          return mappedUser;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        throw new UserEmailConflictError();
      }

      throw error;
    }
  }

  async update(
    userId: string,
    data: UpdateUserData,
    context: AuditContext,
  ): Promise<UserManagementRecord | null> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const existing = await transaction.user.findUnique({
          where: { id: userId },
          select: managementUserSelect,
        });

        if (!existing) {
          return null;
        }

        const before = mapManagementUser(existing);
        const updateData: Prisma.UserUpdateInput = {
          ...(data.email !== undefined ? { email: data.email } : {}),
          ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
          ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
          ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
        };
        const updated = await transaction.user.update({
          where: { id: userId },
          data: updateData,
          select: managementUserSelect,
        });
        const after = mapManagementUser(updated);

        await transaction.auditLog.create({
          data: {
            ...auditFields(context),
            action: 'users.updated',
            subjectType: 'user',
            subjectId: userId,
            beforeSummary: auditSummary(before),
            afterSummary: auditSummary(after),
          },
        });

        return after;
      });
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        throw new UserEmailConflictError();
      }

      throw error;
    }
  }

  async updateStatus(
    userId: string,
    status: Exclude<UserStatusValue, 'DELETED'>,
    context: AuditContext,
  ): Promise<UserManagementRecord | null> {
    return this.client.$transaction(
      async (transaction) => {
        const existing = await transaction.user.findUnique({
          where: { id: userId },
          select: managementUserSelect,
        });

        if (!existing) {
          return null;
        }

        const before = mapManagementUser(existing);
        const now = new Date();

        if (
          before.status === UserStatus.ACTIVE &&
          status !== UserStatus.ACTIVE &&
          before.roles.includes(RoleCode.ADMIN)
        ) {
          await assertAnotherActiveAdministrator(transaction, userId, now);
        }

        const updated = await transaction.user.update({
          where: { id: userId },
          data: { status },
          select: managementUserSelect,
        });

        if (status !== UserStatus.ACTIVE) {
          await transaction.userSession.updateMany({
            where: { userId, revokedAt: null },
            data: {
              revokedAt: now,
              revocationReason: `account_${status.toLowerCase()}`,
              lastActivityAt: now,
            },
          });
        }

        const after = mapManagementUser(updated, now);
        await transaction.auditLog.create({
          data: {
            ...auditFields(context),
            action: `users.status.${status.toLowerCase()}`,
            subjectType: 'user',
            subjectId: userId,
            beforeSummary: auditSummary(before),
            afterSummary: auditSummary(after),
          },
        });

        return after;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async replaceRoles(
    userId: string,
    roleCodes: RoleCode[],
    context: AuditContext,
  ): Promise<UserManagementRecord | null> {
    return this.client.$transaction(
      async (transaction) => {
        const existing = await transaction.user.findUnique({
          where: { id: userId },
          select: managementUserSelect,
        });

        if (!existing) {
          return null;
        }

        const before = mapManagementUser(existing);
        const now = new Date();

        if (
          before.status === UserStatus.ACTIVE &&
          before.roles.includes(RoleCode.ADMIN) &&
          !roleCodes.includes(RoleCode.ADMIN)
        ) {
          await assertAnotherActiveAdministrator(transaction, userId, now);
        }

        const roles = await rolesByCodes(transaction, roleCodes);
        await transaction.userRole.deleteMany({ where: { userId } });
        await transaction.userRole.createMany({
          data: roles.map((role) => ({
            userId,
            roleId: role.id,
            assignedByUserId: context.actorUserId,
          })),
        });
        const updated = await transaction.user.findUniqueOrThrow({
          where: { id: userId },
          select: managementUserSelect,
        });
        const after = mapManagementUser(updated, now);

        await transaction.auditLog.create({
          data: {
            ...auditFields(context),
            action: 'users.roles.replaced',
            subjectType: 'user',
            subjectId: userId,
            beforeSummary: auditSummary(before),
            afterSummary: auditSummary(after),
          },
        });

        return after;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async softDelete(userId: string, context: AuditContext): Promise<UserManagementRecord | null> {
    return this.client.$transaction(
      async (transaction) => {
        const existing = await transaction.user.findUnique({
          where: { id: userId },
          select: managementUserSelect,
        });

        if (!existing) {
          return null;
        }

        const before = mapManagementUser(existing);

        if (before.deletedAt) {
          return before;
        }

        const now = new Date();

        if (before.status === UserStatus.ACTIVE && before.roles.includes(RoleCode.ADMIN)) {
          await assertAnotherActiveAdministrator(transaction, userId, now);
        }

        const deleted = await transaction.user.update({
          where: { id: userId },
          data: {
            status: UserStatus.DELETED,
            deletedAt: now,
          },
          select: managementUserSelect,
        });
        await transaction.userSession.updateMany({
          where: { userId, revokedAt: null },
          data: {
            revokedAt: now,
            revocationReason: 'account_deleted',
            lastActivityAt: now,
          },
        });
        const after = mapManagementUser(deleted, now);

        await transaction.auditLog.create({
          data: {
            ...auditFields(context),
            action: 'users.deleted',
            subjectType: 'user',
            subjectId: userId,
            beforeSummary: auditSummary(before),
            afterSummary: auditSummary(after),
          },
        });

        return after;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async restore(userId: string, context: AuditContext): Promise<UserManagementRecord | null> {
    return this.client.$transaction(async (transaction) => {
      const existing = await transaction.user.findUnique({
        where: { id: userId },
        select: managementUserSelect,
      });

      if (!existing) {
        return null;
      }

      const before = mapManagementUser(existing);

      if (!before.deletedAt || before.status !== UserStatus.DELETED) {
        return before;
      }

      const restored = await transaction.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.DEACTIVATED,
          deletedAt: null,
        },
        select: managementUserSelect,
      });
      const after = mapManagementUser(restored);

      await transaction.auditLog.create({
        data: {
          ...auditFields(context),
          action: 'users.restored',
          subjectType: 'user',
          subjectId: userId,
          beforeSummary: auditSummary(before),
          afterSummary: auditSummary(after),
        },
      });

      return after;
    });
  }

  async statistics(): Promise<UserStatistics> {
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60_000);
    const nonDeleted = { deletedAt: null } satisfies Prisma.UserWhereInput;
    const [
      total,
      active,
      suspended,
      deactivated,
      deleted,
      emailVerified,
      emailUnverified,
      createdLast30Days,
      rolesWithCounts,
    ] = await this.client.$transaction([
      this.client.user.count(),
      this.client.user.count({
        where: { status: UserStatus.ACTIVE, deletedAt: null },
      }),
      this.client.user.count({
        where: { status: UserStatus.SUSPENDED, deletedAt: null },
      }),
      this.client.user.count({
        where: { status: UserStatus.DEACTIVATED, deletedAt: null },
      }),
      this.client.user.count({
        where: { status: UserStatus.DELETED, deletedAt: { not: null } },
      }),
      this.client.user.count({
        where: { ...nonDeleted, emailVerifiedAt: { not: null } },
      }),
      this.client.user.count({
        where: { ...nonDeleted, emailVerifiedAt: null },
      }),
      this.client.user.count({
        where: { ...nonDeleted, createdAt: { gte: last30Days } },
      }),
      this.client.role.findMany({
        select: {
          code: true,
          _count: {
            select: {
              users: {
                where: {
                  user: nonDeleted,
                  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
                },
              },
            },
          },
        },
      }),
    ]);
    const byRole: Record<RoleCode, number> = {
      ADMIN: 0,
      TEACHER: 0,
      STUDENT: 0,
    };

    for (const role of rolesWithCounts) {
      byRole[role.code] = role._count.users;
    }

    return {
      total,
      active,
      suspended,
      deactivated,
      deleted,
      emailVerified,
      emailUnverified,
      createdLast30Days,
      byRole,
    };
  }
}
