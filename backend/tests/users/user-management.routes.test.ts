import { RoleCode, SessionClientType, UserStatus } from '@prisma/client';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { vi } from 'vitest';
import { errorHandler } from '../../src/middlewares/error-handler.middleware.js';
import { UserManagementController } from '../../src/modules/users/user-management.controller.js';
import { createUserManagementRouter } from '../../src/modules/users/user-management.routes.js';
import type { UserManagementUseCases } from '../../src/modules/users/user-management.service.js';
import type {
  AuditContext,
  CreateUserData,
  UpdateUserData,
  UserListQuery,
  UserManagementActor,
} from '../../src/modules/users/user-management.types.js';
import {
  requirePermission,
  requireRole,
} from '../../src/modules/authorization/authorization.middleware.js';
import type { AuthenticatedPrincipal } from '../../src/modules/authorization/authorization.types.js';
import {
  ADMIN_USER_ID,
  MANAGED_USER_ID,
  createManagedUser,
} from '../helpers/user-management-fakes.js';

class StubUserManagementService implements UserManagementUseCases {
  list = vi.fn(async (_query: UserListQuery) => ({
    items: [createManagedUser()],
    pagination: {
      page: 1,
      pageSize: 20,
      totalItems: 1,
      totalPages: 1,
    },
  }));

  getById = vi.fn(async (_userId: string) => createManagedUser());

  create = vi.fn(async (data: CreateUserData, _context: AuditContext) =>
    createManagedUser({
      email: data.email,
      status: data.status,
      roles: data.roles,
    }),
  );

  update = vi.fn(async (_userId: string, data: UpdateUserData, _context: AuditContext) =>
    createManagedUser({
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
      ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
      ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
    }),
  );

  updateStatus = vi.fn(
    async (
      _userId: string,
      status: Exclude<UserStatus, 'DELETED'>,
      _actor: UserManagementActor,
      _context: AuditContext,
    ) => createManagedUser({ status }),
  );

  replaceRoles = vi.fn(
    async (
      _userId: string,
      roles: RoleCode[],
      _actor: UserManagementActor,
      _context: AuditContext,
    ) => createManagedUser({ roles }),
  );

  delete = vi.fn(
    async (_userId: string, _actor: UserManagementActor, _context: AuditContext): Promise<void> =>
      undefined,
  );

  restore = vi.fn(async (_userId: string, _context: AuditContext) =>
    createManagedUser({ status: UserStatus.DEACTIVATED, deletedAt: null }),
  );

  getStatistics = vi.fn(async () => ({
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
  }));
}

function authenticatedAs(roles: RoleCode[], permissions: string[]): RequestHandler {
  return (incomingRequest, _response, next) => {
    const principal: AuthenticatedPrincipal = {
      userId: ADMIN_USER_ID,
      sessionId: '019b9e22-8022-796f-b12a-bb56ba452725',
      clientType: SessionClientType.WEB,
      roles,
      permissions,
    };
    (incomingRequest as typeof incomingRequest & { auth?: AuthenticatedPrincipal }).auth =
      principal;
    next();
  };
}

function createTestApp(
  service: StubUserManagementService,
  roles: RoleCode[],
  permissions: string[],
): express.Express {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1/users',
    createUserManagementRouter({
      controller: new UserManagementController(service),
      authenticationMiddleware: authenticatedAs(roles, permissions),
      adminRoleMiddleware: requireRole(RoleCode.ADMIN),
      permissionMiddleware: requirePermission,
    }),
  );
  app.use(errorHandler);
  return app;
}

describe('User Management routes', () => {
  it('allows an administrator with users.read to list users', async () => {
    const service = new StubUserManagementService();
    const app = createTestApp(service, [RoleCode.ADMIN], ['users.read']);

    const response = await request(app)
      .get('/api/v1/users')
      .query({ search: 'ALI', page: 1, pageSize: 20 })
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      message: 'Foydalanuvchilar ro‘yxati olindi.',
    });
    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'ALI', page: 1, pageSize: 20 }),
    );
  });

  it('denies a teacher even when the permission is present', async () => {
    const service = new StubUserManagementService();
    const app = createTestApp(service, [RoleCode.TEACHER], ['users.read']);

    const response = await request(app).get('/api/v1/users').expect(403);

    expect(response.body.code).toBe('ACCESS_DENIED');
    expect(service.list).not.toHaveBeenCalled();
  });

  it('denies an administrator without the endpoint permission', async () => {
    const service = new StubUserManagementService();
    const app = createTestApp(service, [RoleCode.ADMIN], []);

    const response = await request(app).get('/api/v1/users/statistics').expect(403);

    expect(response.body.code).toBe('ACCESS_DENIED');
    expect(service.getStatistics).not.toHaveBeenCalled();
  });

  it('validates pagination before calling the service', async () => {
    const service = new StubUserManagementService();
    const app = createTestApp(service, [RoleCode.ADMIN], ['users.read']);

    const response = await request(app)
      .get('/api/v1/users')
      .query({ page: 0, pageSize: 500 })
      .expect(422);

    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(service.list).not.toHaveBeenCalled();
  });

  it('creates a deactivated student by default and normalizes email', async () => {
    const service = new StubUserManagementService();
    const app = createTestApp(service, [RoleCode.ADMIN], ['users.create', 'roles.assign']);

    const response = await request(app)
      .post('/api/v1/users')
      .send({ email: '  NEW.USER@EXAMPLE.COM  ', firstName: 'Yangi' })
      .expect(201);

    expect(response.headers.location).toBe(`/api/v1/users/${MANAGED_USER_ID}`);
    expect(response.body.message).toBe('Foydalanuvchi yaratildi.');
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new.user@example.com',
        status: UserStatus.DEACTIVATED,
        roles: [RoleCode.STUDENT],
      }),
      expect.objectContaining({ actorUserId: ADMIN_USER_ID }),
    );
  });

  it('requires explicit destructive confirmation before soft deletion', async () => {
    const service = new StubUserManagementService();
    const app = createTestApp(service, [RoleCode.ADMIN], ['users.delete']);

    const response = await request(app)
      .delete(`/api/v1/users/${MANAGED_USER_ID}`)
      .send({ confirmation: false })
      .expect(422);

    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(service.delete).not.toHaveBeenCalled();
  });

  it('passes administrator permissions to dynamic status authorization', async () => {
    const service = new StubUserManagementService();
    const app = createTestApp(service, [RoleCode.ADMIN], ['users.suspend']);

    const response = await request(app)
      .patch(`/api/v1/users/${MANAGED_USER_ID}/status`)
      .send({ status: UserStatus.SUSPENDED })
      .expect(200);

    expect(response.body.data.status).toBe(UserStatus.SUSPENDED);
    expect(service.updateStatus).toHaveBeenCalledWith(
      MANAGED_USER_ID,
      UserStatus.SUSPENDED,
      expect.objectContaining({
        userId: ADMIN_USER_ID,
        permissions: ['users.suspend'],
      }),
      expect.objectContaining({ actorUserId: ADMIN_USER_ID }),
    );
  });
});
