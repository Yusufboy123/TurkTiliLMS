import { CourseLevel, CourseStatus, RoleCode, SessionClientType } from '@prisma/client';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { vi } from 'vitest';
import { errorHandler } from '../../src/middlewares/error-handler.middleware.js';
import {
  requirePermission,
  requireRole,
} from '../../src/modules/authorization/authorization.middleware.js';
import type { AuthenticatedPrincipal } from '../../src/modules/authorization/authorization.types.js';
import { CourseController } from '../../src/modules/courses/course.controller.js';
import {
  createCourseCatalogRouter,
  createCourseRouter,
} from '../../src/modules/courses/course.routes.js';
import type {
  CreateCourseInput,
  UpdateCourseInput,
} from '../../src/modules/courses/course.schemas.js';
import type { CourseManagementUseCases } from '../../src/modules/courses/course.service.js';
import type {
  CatalogCourseListQuery,
  CourseActor,
  CourseAuditContext,
  CourseListQuery,
} from '../../src/modules/courses/course.types.js';
import { AppError } from '../../src/utils/app-error.js';
import {
  COURSE_ADMIN_ID,
  COURSE_TEACHER_ID,
  TEST_COURSE_ID,
  createCourseRecord,
} from '../helpers/course-fakes.js';

class StubCourseService implements CourseManagementUseCases {
  list = vi.fn(async (query: CourseListQuery, _actor: CourseActor) => ({
    items: [createCourseRecord()],
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems: 1,
      totalPages: 1,
    },
  }));

  statistics = vi.fn(async (_actor: CourseActor) => ({
    total: 1,
    draft: 1,
    inReview: 0,
    published: 0,
    archived: 0,
    deleted: 0,
    featured: 0,
    byLevel: {
      A1: 1,
      A2: 0,
      B1: 0,
      B2: 0,
      C1: 0,
      C2: 0,
    },
    byTeacher: [],
  }));

  getById = vi.fn(async (_courseId: string, _actor: CourseActor) => createCourseRecord());

  create = vi.fn(
    async (input: CreateCourseInput, actor: CourseActor, _context: CourseAuditContext) =>
      createCourseRecord({
        title: input.title,
        slug: input.slug ?? 'generated-slug',
        contentLanguage: input.contentLanguage,
        level: input.level ?? null,
        createdByUserId: actor.userId,
      }),
  );

  update = vi.fn(
    async (
      _courseId: string,
      input: UpdateCourseInput,
      _actor: CourseActor,
      _context: CourseAuditContext,
    ) =>
      createCourseRecord({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
      }),
  );

  updateStatus = vi.fn(
    async (
      _courseId: string,
      targetStatus: CourseStatus,
      _actor: CourseActor,
      _context: CourseAuditContext,
    ) => createCourseRecord({ status: targetStatus }),
  );

  assignTeacher = vi.fn(
    async (
      _courseId: string,
      _teacherId: string | null,
      _actor: CourseActor,
      _context: CourseAuditContext,
    ) => createCourseRecord(),
  );

  delete = vi.fn(
    async (_courseId: string, _actor: CourseActor, _context: CourseAuditContext): Promise<void> =>
      undefined,
  );

  restore = vi.fn(async (_courseId: string, _actor: CourseActor, _context: CourseAuditContext) =>
    createCourseRecord({ status: CourseStatus.DRAFT, deletedAt: null }),
  );

  listCatalog = vi.fn(async (query: CatalogCourseListQuery) => ({
    items: [
      {
        id: TEST_COURSE_ID,
        title: 'Published course',
        slug: 'published-course',
        shortDescription: 'Public summary',
        description: 'Public description',
        coverImageUrl: null,
        contentLanguage: 'tr',
        level: CourseLevel.A1,
        teacher: {
          id: COURSE_TEACHER_ID,
          firstName: 'Ali',
          lastName: 'Ustoz',
          displayName: 'Ali Ustoz',
        },
        estimatedDurationMinutes: 300,
        sortOrder: 0,
        isFeatured: true,
        publishedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ],
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems: 1,
      totalPages: 1,
    },
  }));

  getCatalogBySlug = vi.fn(async (_slug: string) => ({
    id: TEST_COURSE_ID,
    title: 'Published course',
    slug: 'published-course',
    shortDescription: 'Public summary',
    description: 'Public description',
    coverImageUrl: null,
    contentLanguage: 'tr',
    level: CourseLevel.A1,
    teacher: {
      id: COURSE_TEACHER_ID,
      firstName: 'Ali',
      lastName: 'Ustoz',
      displayName: 'Ali Ustoz',
    },
    estimatedDurationMinutes: 300,
    sortOrder: 0,
    isFeatured: true,
    publishedAt: new Date('2026-01-01T00:00:00.000Z'),
  }));
}

function authenticationMiddleware(principal: AuthenticatedPrincipal | null): RequestHandler {
  return (incomingRequest, _response, next) => {
    if (!principal) {
      next(
        new AppError(
          'Davom etish uchun tizimga kirish talab qilinadi.',
          401,
          'AUTHENTICATION_REQUIRED',
        ),
      );
      return;
    }

    (incomingRequest as typeof incomingRequest & { auth?: AuthenticatedPrincipal }).auth =
      principal;
    next();
  };
}

function principal(roles: RoleCode[], permissions: string[]): AuthenticatedPrincipal {
  return {
    userId: roles.includes(RoleCode.TEACHER) ? COURSE_TEACHER_ID : COURSE_ADMIN_ID,
    sessionId: '019b9e22-e356-713e-be3a-ab43b5b43f8b',
    clientType: SessionClientType.WEB,
    roles,
    permissions,
  };
}

function createTestApp(
  service: StubCourseService,
  authenticatedPrincipal: AuthenticatedPrincipal | null,
): express.Express {
  const controller = new CourseController(service);
  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1/courses',
    createCourseRouter({
      controller,
      authenticationMiddleware: authenticationMiddleware(authenticatedPrincipal),
      managementRoleMiddleware: requireRole(RoleCode.ADMIN, RoleCode.TEACHER),
      adminRoleMiddleware: requireRole(RoleCode.ADMIN),
      permissionMiddleware: requirePermission,
    }),
  );
  app.use('/api/v1/catalog/courses', createCourseCatalogRouter(controller));
  app.use(errorHandler);
  return app;
}

describe('Course routes', () => {
  it('allows an admin to create a course', async () => {
    const service = new StubCourseService();
    const app = createTestApp(
      service,
      principal([RoleCode.ADMIN], ['courses.create', 'courses.assign_teacher']),
    );

    const response = await request(app)
      .post('/api/v1/courses')
      .send({
        title: 'Admin kursi',
        teacherId: COURSE_TEACHER_ID,
        level: CourseLevel.A1,
      })
      .expect(201);

    expect(response.headers.location).toBe(`/api/v1/courses/${TEST_COURSE_ID}`);
    expect(response.body.message).toBe('Kurs yaratildi.');
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Admin kursi',
        teacherId: COURSE_TEACHER_ID,
        contentLanguage: 'tr',
      }),
      expect.objectContaining({ userId: COURSE_ADMIN_ID }),
      expect.objectContaining({ actorUserId: COURSE_ADMIN_ID }),
    );
  });

  it('allows a permitted teacher to create a course', async () => {
    const service = new StubCourseService();
    const app = createTestApp(service, principal([RoleCode.TEACHER], ['courses.create']));

    await request(app).post('/api/v1/courses').send({ title: 'Teacher kursi' }).expect(201);

    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Teacher kursi' }),
      expect.objectContaining({
        userId: COURSE_TEACHER_ID,
        roles: [RoleCode.TEACHER],
      }),
      expect.any(Object),
    );
  });

  it('rejects invalid course input before the service', async () => {
    const service = new StubCourseService();
    const app = createTestApp(service, principal([RoleCode.ADMIN], ['courses.create']));

    const response = await request(app)
      .post('/api/v1/courses')
      .send({
        title: 'x',
        slug: 'INVALID SLUG',
        coverImageUrl: 'javascript:alert(1)',
      })
      .expect(422);

    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(service.create).not.toHaveBeenCalled();
  });

  it('parses list pagination and filters', async () => {
    const service = new StubCourseService();
    const app = createTestApp(service, principal([RoleCode.ADMIN], ['courses.read']));

    await request(app)
      .get('/api/v1/courses')
      .query({
        page: 2,
        pageSize: 10,
        search: 'A1',
        level: CourseLevel.A1,
        status: CourseStatus.DRAFT,
        featured: 'true',
      })
      .expect(200);

    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        pageSize: 10,
        search: 'A1',
        level: CourseLevel.A1,
        status: CourseStatus.DRAFT,
        featured: true,
      }),
      expect.objectContaining({ roles: [RoleCode.ADMIN] }),
    );
  });

  it('rejects unauthenticated administration requests', async () => {
    const service = new StubCourseService();
    const app = createTestApp(service, null);

    const response = await request(app).get('/api/v1/courses').expect(401);

    expect(response.body.code).toBe('AUTHENTICATION_REQUIRED');
    expect(service.list).not.toHaveBeenCalled();
  });

  it('forbids students from course administration endpoints', async () => {
    const service = new StubCourseService();
    const app = createTestApp(service, principal([RoleCode.STUDENT], ['courses.read']));

    const response = await request(app).get('/api/v1/courses').expect(403);

    expect(response.body.code).toBe('ACCESS_DENIED');
    expect(service.list).not.toHaveBeenCalled();
  });

  it('requires explicit confirmation for course deletion', async () => {
    const service = new StubCourseService();
    const app = createTestApp(service, principal([RoleCode.ADMIN], ['courses.delete']));

    const response = await request(app)
      .delete(`/api/v1/courses/${TEST_COURSE_ID}`)
      .send({ confirmation: false })
      .expect(422);

    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(service.delete).not.toHaveBeenCalled();
  });

  it('keeps the catalog public and returns only the student-safe contract', async () => {
    const service = new StubCourseService();
    const app = createTestApp(service, null);

    const response = await request(app)
      .get('/api/v1/catalog/courses')
      .query({ level: CourseLevel.A1, featured: 'true' })
      .expect(200);

    expect(response.body.data.items[0]).toMatchObject({
      slug: 'published-course',
      level: CourseLevel.A1,
      isFeatured: true,
    });
    expect(response.body.data.items[0]).not.toHaveProperty('deletedAt');
    expect(response.body.data.items[0]).not.toHaveProperty('createdByUserId');
  });

  it('restricts full statistics to admins with the statistics permission', async () => {
    const service = new StubCourseService();
    const teacherApp = createTestApp(
      service,
      principal([RoleCode.TEACHER], ['courses.view_statistics']),
    );

    await request(teacherApp).get('/api/v1/courses/statistics').expect(403);
    expect(service.statistics).not.toHaveBeenCalled();

    const adminApp = createTestApp(
      service,
      principal([RoleCode.ADMIN], ['courses.view_statistics']),
    );
    await request(adminApp).get('/api/v1/courses/statistics').expect(200);
    expect(service.statistics).toHaveBeenCalledOnce();
  });
});
