import { RoleCode, UserStatus } from '@prisma/client';
import type { UserManagementRepository } from '../../src/modules/users/user-management.repository.js';
import type {
  AuditContext,
  CreateUserData,
  UpdateUserData,
  UserDetailRecord,
  UserListQuery,
  UserManagementRecord,
  UserStatistics,
} from '../../src/modules/users/user-management.types.js';

export const ADMIN_USER_ID = '019b9e22-7f5d-7d3a-a0f1-ff64c8124a11';
export const MANAGED_USER_ID = '019b9e22-8f9c-771a-9753-67ad8f179af2';

export function createManagedUser(overrides: Partial<UserDetailRecord> = {}): UserDetailRecord {
  return {
    id: MANAGED_USER_ID,
    email: 'student@example.com',
    firstName: 'Ali',
    lastName: 'Valiyev',
    displayName: 'Ali Valiyev',
    status: UserStatus.ACTIVE,
    emailVerifiedAt: null,
    lastLoginAt: null,
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    hasPassword: false,
    roles: [RoleCode.STUDENT],
    activeSessionCount: 1,
    ...overrides,
  };
}

export const testAuditContext: AuditContext = {
  actorUserId: ADMIN_USER_ID,
  requestCorrelationId: '019b9e22-9a70-772d-bcfe-497e36c6de0d',
  ipHash: 'a'.repeat(64),
  userAgentSummary: 'Vitest',
};

export class FakeUserManagementRepository implements UserManagementRepository {
  readonly users = new Map<string, UserDetailRecord>();
  lastAuditContext: AuditContext | null = null;
  lastListQuery: UserListQuery | null = null;
  lastCreatedData: CreateUserData | null = null;
  statusUpdates = 0;
  roleUpdates = 0;
  deleteCalls = 0;
  restoreCalls = 0;
  createError: Error | null = null;
  statusError: Error | null = null;
  roleError: Error | null = null;
  deleteError: Error | null = null;
  statisticsResult: UserStatistics = {
    total: 1,
    active: 1,
    suspended: 0,
    deactivated: 0,
    deleted: 0,
    emailVerified: 0,
    emailUnverified: 1,
    createdLast30Days: 1,
    byRole: {
      ADMIN: 0,
      TEACHER: 0,
      STUDENT: 1,
    },
  };

  constructor(users: UserDetailRecord[] = [createManagedUser()]) {
    for (const user of users) {
      this.users.set(user.id, user);
    }
  }

  list(query: UserListQuery): Promise<{ items: UserManagementRecord[]; total: number }> {
    this.lastListQuery = query;
    const users = [...this.users.values()];
    return Promise.resolve({ items: users, total: users.length });
  }

  findById(userId: string): Promise<UserDetailRecord | null> {
    return Promise.resolve(this.users.get(userId) ?? null);
  }

  create(data: CreateUserData, context: AuditContext): Promise<UserManagementRecord> {
    if (this.createError) {
      return Promise.reject(this.createError);
    }

    this.lastAuditContext = context;
    this.lastCreatedData = data;
    const user = createManagedUser({
      id: '019b9e22-a88b-77bb-b9f5-1449738a39ca',
      email: data.email,
      firstName: data.firstName ?? null,
      lastName: data.lastName ?? null,
      displayName: data.displayName ?? null,
      status: data.status,
      roles: data.roles,
    });
    this.users.set(user.id, user);
    return Promise.resolve(user);
  }

  update(
    userId: string,
    data: UpdateUserData,
    context: AuditContext,
  ): Promise<UserManagementRecord | null> {
    const user = this.users.get(userId);

    if (!user) {
      return Promise.resolve(null);
    }

    this.lastAuditContext = context;
    const updated: UserDetailRecord = {
      ...user,
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
      ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
      ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
      updatedAt: new Date(),
    };
    this.users.set(userId, updated);
    return Promise.resolve(updated);
  }

  updateStatus(
    userId: string,
    status: Exclude<UserStatus, 'DELETED'>,
    context: AuditContext,
  ): Promise<UserManagementRecord | null> {
    if (this.statusError) {
      return Promise.reject(this.statusError);
    }

    const user = this.users.get(userId);

    if (!user) {
      return Promise.resolve(null);
    }

    this.lastAuditContext = context;
    this.statusUpdates += 1;
    const updated = { ...user, status };
    this.users.set(userId, updated);
    return Promise.resolve(updated);
  }

  replaceRoles(
    userId: string,
    roles: RoleCode[],
    context: AuditContext,
  ): Promise<UserManagementRecord | null> {
    if (this.roleError) {
      return Promise.reject(this.roleError);
    }

    const user = this.users.get(userId);

    if (!user) {
      return Promise.resolve(null);
    }

    this.lastAuditContext = context;
    this.roleUpdates += 1;
    const updated = { ...user, roles };
    this.users.set(userId, updated);
    return Promise.resolve(updated);
  }

  softDelete(userId: string, context: AuditContext): Promise<UserManagementRecord | null> {
    if (this.deleteError) {
      return Promise.reject(this.deleteError);
    }

    const user = this.users.get(userId);

    if (!user) {
      return Promise.resolve(null);
    }

    this.lastAuditContext = context;
    this.deleteCalls += 1;
    const deleted = {
      ...user,
      status: UserStatus.DELETED,
      deletedAt: new Date(),
      activeSessionCount: 0,
    };
    this.users.set(userId, deleted);
    return Promise.resolve(deleted);
  }

  restore(userId: string, context: AuditContext): Promise<UserManagementRecord | null> {
    const user = this.users.get(userId);

    if (!user) {
      return Promise.resolve(null);
    }

    this.lastAuditContext = context;
    this.restoreCalls += 1;
    const restored = {
      ...user,
      status: UserStatus.DEACTIVATED,
      deletedAt: null,
    };
    this.users.set(userId, restored);
    return Promise.resolve(restored);
  }

  statistics(): Promise<UserStatistics> {
    return Promise.resolve(this.statisticsResult);
  }
}
