import { RoleCode, UserStatus } from '@prisma/client';
import {
  LastActiveAdministratorError,
  UserEmailConflictError,
} from '../../src/modules/users/user-management.repository.js';
import { UserManagementService } from '../../src/modules/users/user-management.service.js';
import type { UserListQuery } from '../../src/modules/users/user-management.types.js';
import { AppError } from '../../src/utils/app-error.js';
import {
  ADMIN_USER_ID,
  FakeUserManagementRepository,
  MANAGED_USER_ID,
  createManagedUser,
  testAuditContext,
} from '../helpers/user-management-fakes.js';

const defaultQuery: UserListQuery = {
  page: 1,
  pageSize: 20,
  deleted: 'exclude',
  sortBy: 'createdAt',
  sortDirection: 'desc',
};

const adminActor = {
  userId: ADMIN_USER_ID,
  permissions: [
    'users.read',
    'users.create',
    'users.update',
    'users.suspend',
    'users.deactivate',
    'users.restore',
    'users.delete',
    'roles.assign',
  ],
};

function expectAppError(error: unknown, code: string, statusCode: number): void {
  expect(error).toBeInstanceOf(AppError);
  expect(error).toMatchObject({ code, statusCode });
}

describe('UserManagementService', () => {
  it('returns bounded pagination metadata and forwards list filters', async () => {
    const repository = new FakeUserManagementRepository();
    const service = new UserManagementService(repository);
    const query = { ...defaultQuery, pageSize: 10, search: 'ali', role: RoleCode.STUDENT };

    const result = await service.list(query);

    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 10,
      totalItems: 1,
      totalPages: 1,
    });
    expect(repository.lastListQuery).toEqual(query);
  });

  it('returns a safe user detail without credential data', async () => {
    const repository = new FakeUserManagementRepository();
    const service = new UserManagementService(repository);

    const result = await service.getById(MANAGED_USER_ID);

    expect(result.email).toBe('student@example.com');
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('returns USER_NOT_FOUND for an unknown user', async () => {
    const service = new UserManagementService(new FakeUserManagementRepository([]));

    await expect(service.getById(MANAGED_USER_ID)).rejects.toSatisfy((error: unknown) => {
      expectAppError(error, 'USER_NOT_FOUND', 404);
      return true;
    });
  });

  it('creates a user and forwards the complete audit context', async () => {
    const repository = new FakeUserManagementRepository([]);
    const service = new UserManagementService(repository);

    const result = await service.create(
      {
        email: 'new@example.com',
        firstName: 'Yangi',
        status: UserStatus.DEACTIVATED,
        roles: [RoleCode.STUDENT],
      },
      testAuditContext,
    );

    expect(result.email).toBe('new@example.com');
    expect(repository.lastAuditContext).toEqual(testAuditContext);
    expect(repository.lastCreatedData?.roles).toEqual([RoleCode.STUDENT]);
  });

  it('maps duplicate emails to a stable conflict error', async () => {
    const repository = new FakeUserManagementRepository([]);
    repository.createError = new UserEmailConflictError();
    const service = new UserManagementService(repository);

    await expect(
      service.create(
        {
          email: 'duplicate@example.com',
          status: UserStatus.DEACTIVATED,
          roles: [RoleCode.STUDENT],
        },
        testAuditContext,
      ),
    ).rejects.toSatisfy((error: unknown) => {
      expectAppError(error, 'USER_EMAIL_CONFLICT', 409);
      return true;
    });
  });

  it('does not allow an administrator to update a soft-deleted user', async () => {
    const deletedUser = createManagedUser({
      status: UserStatus.DELETED,
      deletedAt: new Date(),
    });
    const service = new UserManagementService(new FakeUserManagementRepository([deletedUser]));

    await expect(
      service.update(MANAGED_USER_ID, { firstName: 'Boshqa' }, testAuditContext),
    ).rejects.toSatisfy((error: unknown) => {
      expectAppError(error, 'USER_IS_DELETED', 409);
      return true;
    });
  });

  it('requires the permission matching the requested status transition', async () => {
    const service = new UserManagementService(new FakeUserManagementRepository());

    await expect(
      service.updateStatus(
        MANAGED_USER_ID,
        UserStatus.SUSPENDED,
        { userId: ADMIN_USER_ID, permissions: ['users.update'] },
        testAuditContext,
      ),
    ).rejects.toSatisfy((error: unknown) => {
      expectAppError(error, 'ACCESS_DENIED', 403);
      return true;
    });
  });

  it('updates status when the administrator has the specific permission', async () => {
    const repository = new FakeUserManagementRepository();
    const service = new UserManagementService(repository);

    const result = await service.updateStatus(
      MANAGED_USER_ID,
      UserStatus.SUSPENDED,
      adminActor,
      testAuditContext,
    );

    expect(result.status).toBe(UserStatus.SUSPENDED);
    expect(repository.statusUpdates).toBe(1);
    expect(repository.lastAuditContext).toEqual(testAuditContext);
  });

  it('blocks self-suspension', async () => {
    const administrator = createManagedUser({
      id: ADMIN_USER_ID,
      roles: [RoleCode.ADMIN],
    });
    const service = new UserManagementService(new FakeUserManagementRepository([administrator]));

    await expect(
      service.updateStatus(ADMIN_USER_ID, UserStatus.SUSPENDED, adminActor, testAuditContext),
    ).rejects.toSatisfy((error: unknown) => {
      expectAppError(error, 'SELF_STATUS_CHANGE_FORBIDDEN', 409);
      return true;
    });
  });

  it('blocks removal of the acting administrator own ADMIN role', async () => {
    const administrator = createManagedUser({
      id: ADMIN_USER_ID,
      roles: [RoleCode.ADMIN],
    });
    const service = new UserManagementService(new FakeUserManagementRepository([administrator]));

    await expect(
      service.replaceRoles(ADMIN_USER_ID, [RoleCode.TEACHER], adminActor, testAuditContext),
    ).rejects.toSatisfy((error: unknown) => {
      expectAppError(error, 'SELF_ADMIN_ROLE_REMOVAL_FORBIDDEN', 409);
      return true;
    });
  });

  it('maps last administrator protection to a stable conflict error', async () => {
    const administrator = createManagedUser({ roles: [RoleCode.ADMIN] });
    const repository = new FakeUserManagementRepository([administrator]);
    repository.roleError = new LastActiveAdministratorError();
    const service = new UserManagementService(repository);

    await expect(
      service.replaceRoles(MANAGED_USER_ID, [RoleCode.STUDENT], adminActor, testAuditContext),
    ).rejects.toSatisfy((error: unknown) => {
      expectAppError(error, 'LAST_ACTIVE_ADMIN_REQUIRED', 409);
      return true;
    });
  });

  it('blocks self-deletion', async () => {
    const service = new UserManagementService(new FakeUserManagementRepository());

    await expect(service.delete(ADMIN_USER_ID, adminActor, testAuditContext)).rejects.toSatisfy(
      (error: unknown) => {
        expectAppError(error, 'SELF_DELETE_FORBIDDEN', 409);
        return true;
      },
    );
  });

  it('soft-deletes a managed user with audit attribution', async () => {
    const repository = new FakeUserManagementRepository();
    const service = new UserManagementService(repository);

    await service.delete(MANAGED_USER_ID, adminActor, testAuditContext);

    expect(repository.deleteCalls).toBe(1);
    expect(repository.users.get(MANAGED_USER_ID)).toMatchObject({
      status: UserStatus.DELETED,
      activeSessionCount: 0,
    });
    expect(repository.lastAuditContext).toEqual(testAuditContext);
  });

  it('restores only soft-deleted users into DEACTIVATED state', async () => {
    const deletedUser = createManagedUser({
      status: UserStatus.DELETED,
      deletedAt: new Date(),
      activeSessionCount: 0,
    });
    const repository = new FakeUserManagementRepository([deletedUser]);
    const service = new UserManagementService(repository);

    const restored = await service.restore(MANAGED_USER_ID, testAuditContext);

    expect(restored.status).toBe(UserStatus.DEACTIVATED);
    expect(restored.deletedAt).toBeNull();
    expect(repository.restoreCalls).toBe(1);
  });

  it('rejects restoration for a user that is not deleted', async () => {
    const service = new UserManagementService(new FakeUserManagementRepository());

    await expect(service.restore(MANAGED_USER_ID, testAuditContext)).rejects.toSatisfy(
      (error: unknown) => {
        expectAppError(error, 'USER_NOT_DELETED', 409);
        return true;
      },
    );
  });

  it('returns aggregate user statistics from the repository', async () => {
    const repository = new FakeUserManagementRepository();
    const service = new UserManagementService(repository);

    await expect(service.getStatistics()).resolves.toEqual(repository.statisticsResult);
  });
});
