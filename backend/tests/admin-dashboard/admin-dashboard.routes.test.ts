import { RoleCode, SessionClientType } from '@prisma/client';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { vi } from 'vitest';
import { errorHandler } from '../../src/middlewares/error-handler.middleware.js';
import { AdminDashboardController } from '../../src/modules/admin-dashboard/admin-dashboard.controller.js';
import {
  adminDashboardNoStore,
  createAdminDashboardRateLimitMiddleware,
} from '../../src/modules/admin-dashboard/admin-dashboard.rate-limit.js';
import { createAdminDashboardRouter } from '../../src/modules/admin-dashboard/admin-dashboard.routes.js';
import type { AdminDashboardUseCases } from '../../src/modules/admin-dashboard/admin-dashboard.service.js';
import type {
  AdminDashboardActor,
  AdminDashboardAuditContext,
} from '../../src/modules/admin-dashboard/admin-dashboard.types.js';
import {
  requirePermission,
  requireRole,
} from '../../src/modules/authorization/authorization.middleware.js';
import type { AuthenticatedPrincipal } from '../../src/modules/authorization/authorization.types.js';
import { AppError } from '../../src/utils/app-error.js';

const ADMIN_ID = '019d0000-0000-7000-8000-000000000911';
const SESSION_ID = '019d0000-0000-7000-8000-000000000912';
const requiredPermissions = [
  'users.read',
  'courses.view_statistics',
  'progress.read',
  'certificates.course_read',
];
const summary = {
  generatedAt: '2026-08-01T10:00:00.000Z',
  users: {
    total: 3,
    active: 3,
    suspended: 0,
    deactivated: 0,
    deleted: 0,
    students: 1,
    teachers: 1,
    administrators: 1,
  },
  courses: { total: 1, draft: 0, inReview: 0, published: 1, archived: 0, deleted: 0 },
  enrollments: { total: 1, active: 1, suspended: 0, completed: 0, cancelled: 0 },
  progress: { trackedEnrollments: 1, averageCompletionPercentage: 35 },
  certificates: { total: 0, issued: 0, revoked: 0 },
};

class StubAdminDashboardService implements AdminDashboardUseCases {
  readonly getSummary = vi.fn(
    async (_actor: AdminDashboardActor, _context: AdminDashboardAuditContext) => summary,
  );
  readonly consumeRateLimit = vi.fn(
    async (_actor: AdminDashboardActor, _context: AdminDashboardAuditContext) => ({
      allowed: true,
      limit: 30,
      remaining: 29,
      resetAfterSeconds: 60,
    }),
  );
}

function principal(roles: RoleCode[], permissions: string[]): AuthenticatedPrincipal {
  return {
    userId: ADMIN_ID,
    sessionId: SESSION_ID,
    clientType: SessionClientType.WEB,
    roles,
    permissions,
  };
}

function authentication(value: AuthenticatedPrincipal | null): RequestHandler {
  return (incoming, _response, next) => {
    if (!value) {
      next(
        new AppError(
          'Davom etish uchun tizimga kirish talab qilinadi.',
          401,
          'AUTHENTICATION_REQUIRED',
        ),
      );
      return;
    }
    (incoming as typeof incoming & { auth?: AuthenticatedPrincipal }).auth = value;
    next();
  };
}

function createApp(
  service: StubAdminDashboardService,
  authenticatedPrincipal: AuthenticatedPrincipal | null,
) {
  const app = express();
  app.use(
    '/api/v1',
    createAdminDashboardRouter({
      controller: new AdminDashboardController(service),
      noStore: adminDashboardNoStore,
      authentication: authentication(authenticatedPrincipal),
      adminRole: requireRole(RoleCode.ADMIN),
      permission: requirePermission,
      rateLimiter: createAdminDashboardRateLimitMiddleware(service),
    }),
  );
  app.use(errorHandler);
  return app;
}

describe('Admin Dashboard route', () => {
  it('returns the complete DTO with private caching and draft-8 rate headers', async () => {
    const service = new StubAdminDashboardService();
    const response = await request(
      createApp(service, principal([RoleCode.ADMIN], requiredPermissions)),
    )
      .get('/api/v1/admin/dashboard/summary')
      .set('X-Request-Id', '019d0000-0000-7000-8000-000000000913')
      .expect(200);

    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers.ratelimit).toBe('"30-in-1min"; r=29; t=60');
    expect(response.headers['ratelimit-policy']).toMatch(
      /^"30-in-1min"; q=30; w=60; pk=:[0-9a-f]{12}:$/u,
    );
    expect(response.body).toEqual({
      success: true,
      message: 'Administrator boshqaruv paneli xulosasi olindi.',
      data: summary,
    });
    expect(service.getSummary).toHaveBeenCalledWith(
      expect.objectContaining({ userId: ADMIN_ID, roles: [RoleCode.ADMIN] }),
      expect.objectContaining({
        actorUserId: ADMIN_ID,
        requestCorrelationId: '019d0000-0000-7000-8000-000000000913',
        ipHash: expect.stringMatching(/^[0-9a-f]{64}$/u),
      }),
    );
    const serialized = JSON.stringify(response.body.data);
    for (const privateField of [
      'email',
      'userId',
      'certificateId',
      'verificationTokenHash',
      'storageKey',
      'audit',
      'metadata',
    ]) {
      expect(serialized).not.toContain(privateField);
    }
  });

  it('denies unauthenticated access without invoking rate limit or summary', async () => {
    const service = new StubAdminDashboardService();
    const response = await request(createApp(service, null))
      .get('/api/v1/admin/dashboard/summary')
      .expect(401);
    expect(response.body.code).toBe('AUTHENTICATION_REQUIRED');
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(service.consumeRateLimit).not.toHaveBeenCalled();
    expect(service.getSummary).not.toHaveBeenCalled();
  });

  it('denies a non-admin even when every permission is present', async () => {
    const service = new StubAdminDashboardService();
    const response = await request(
      createApp(service, principal([RoleCode.TEACHER], requiredPermissions)),
    )
      .get('/api/v1/admin/dashboard/summary')
      .expect(403);
    expect(response.body.code).toBe('ACCESS_DENIED');
    expect(service.consumeRateLimit).not.toHaveBeenCalled();
    expect(service.getSummary).not.toHaveBeenCalled();
  });

  it.each(requiredPermissions)('denies the whole response without %s', async (permission) => {
    const service = new StubAdminDashboardService();
    const response = await request(
      createApp(
        service,
        principal(
          [RoleCode.ADMIN],
          requiredPermissions.filter((candidate) => candidate !== permission),
        ),
      ),
    )
      .get('/api/v1/admin/dashboard/summary')
      .expect(403);
    expect(response.body).toMatchObject({ success: false, code: 'ACCESS_DENIED' });
    expect(response.body).not.toHaveProperty('data');
    expect(service.consumeRateLimit).not.toHaveBeenCalled();
    expect(service.getSummary).not.toHaveBeenCalled();
  });

  it('returns stable shared rate-limit behavior without reading aggregates', async () => {
    const service = new StubAdminDashboardService();
    service.consumeRateLimit.mockResolvedValueOnce({
      allowed: false,
      limit: 30,
      remaining: 0,
      resetAfterSeconds: 17,
    });
    const response = await request(
      createApp(service, principal([RoleCode.ADMIN], requiredPermissions)),
    )
      .get('/api/v1/admin/dashboard/summary')
      .expect(429);

    expect(response.body).toMatchObject({ success: false, code: 'RATE_LIMIT_EXCEEDED' });
    expect(response.headers.ratelimit).toBe('"30-in-1min"; r=0; t=17');
    expect(response.headers['ratelimit-policy']).toMatch(
      /^"30-in-1min"; q=30; w=60; pk=:[0-9a-f]{12}:$/u,
    );
    expect(response.headers['retry-after']).toBe('17');
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(service.getSummary).not.toHaveBeenCalled();
  });

  it('ignores invented query parameters without creating an undocumented error', async () => {
    const service = new StubAdminDashboardService();
    const response = await request(
      createApp(service, principal([RoleCode.ADMIN], requiredPermissions)),
    )
      .get('/api/v1/admin/dashboard/summary?page=1')
      .expect(200);
    expect(response.body.data).toEqual(summary);
    expect(service.getSummary).toHaveBeenCalledOnce();
  });
});
