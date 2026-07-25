import { CourseEnrollmentStatus, RoleCode, SessionClientType } from '@prisma/client';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { errorHandler } from '../../src/middlewares/error-handler.middleware.js';
import {
  requirePermission,
  requireRole,
} from '../../src/modules/authorization/authorization.middleware.js';
import type { AuthenticatedPrincipal } from '../../src/modules/authorization/authorization.types.js';
import { CourseEnrollmentController } from '../../src/modules/course-enrollments/course-enrollment.controller.js';
import {
  createCourseEnrollmentRouter,
  createEnrollmentManagementRouter,
  createMyEnrollmentRouter,
} from '../../src/modules/course-enrollments/course-enrollment.routes.js';
import { CourseEnrollmentService } from '../../src/modules/course-enrollments/course-enrollment.service.js';
import { AppError } from '../../src/utils/app-error.js';
import {
  ADMIN_ID,
  COURSE_ID,
  ENROLLMENT_ID,
  STUDENT_ID,
  FakeCourseEnrollmentRepository,
  createEnrollmentRecord,
} from '../helpers/course-enrollment-fakes.js';

function principal(
  userId: string,
  roles: RoleCode[],
  permissions: string[],
): AuthenticatedPrincipal {
  return {
    userId,
    sessionId: '019b9e22-d58e-75bd-9737-eb615a46fb59',
    clientType: SessionClientType.WEB,
    roles,
    permissions,
  };
}

function authenticationMiddleware(value: AuthenticatedPrincipal | null): RequestHandler {
  return (incomingRequest, _response, next) => {
    if (!value) {
      next(new AppError('Tizimga kirish talab qilinadi.', 401, 'AUTHENTICATION_REQUIRED'));
      return;
    }
    (incomingRequest as typeof incomingRequest & { auth?: AuthenticatedPrincipal }).auth = value;
    next();
  };
}

function createApp(
  repository: FakeCourseEnrollmentRepository,
  authenticatedPrincipal: AuthenticatedPrincipal | null,
): express.Express {
  const controller = new CourseEnrollmentController(new CourseEnrollmentService(repository));
  const dependencies = {
    controller,
    authentication: authenticationMiddleware(authenticatedPrincipal),
    studentRole: requireRole(RoleCode.STUDENT),
    managementRole: requireRole(RoleCode.ADMIN, RoleCode.TEACHER),
    permission: requirePermission,
  };
  const app = express();
  app.use(express.json());
  app.use('/api/v1/courses/:courseId/enrollments', createCourseEnrollmentRouter(dependencies));
  app.use('/api/v1/me/enrollments', createMyEnrollmentRouter(dependencies));
  app.use('/api/v1/enrollments', createEnrollmentManagementRouter(dependencies));
  app.use(errorHandler);
  return app;
}

describe('Course enrollment routes', () => {
  it('allows a permitted student to self-enroll', async () => {
    const repository = new FakeCourseEnrollmentRepository();
    const app = createApp(
      repository,
      principal(STUDENT_ID, [RoleCode.STUDENT], ['enrollments.self_create']),
    );
    const response = await request(app)
      .post(`/api/v1/courses/${COURSE_ID}/enrollments/self`)
      .send({})
      .expect(201);
    expect(response.body.message).toBe('Kursga enrollment qilindi.');
    expect(response.headers.location).toBe(`/api/v1/me/enrollments/${ENROLLMENT_ID}`);
    expect(response.body.data).not.toHaveProperty('createdById');
    expect(response.body.data.course).not.toHaveProperty('teacherId');
  });

  it('rejects client-controlled fields on self-enrollment', async () => {
    const app = createApp(
      new FakeCourseEnrollmentRepository(),
      principal(STUDENT_ID, [RoleCode.STUDENT], ['enrollments.self_create']),
    );
    const response = await request(app)
      .post(`/api/v1/courses/${COURSE_ID}/enrollments/self`)
      .send({ studentId: ADMIN_ID, source: 'ADMIN' })
      .expect(422);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('requires authentication, student role, and self permission', async () => {
    await request(createApp(new FakeCourseEnrollmentRepository(), null))
      .get('/api/v1/me/enrollments')
      .expect(401);
    await request(
      createApp(
        new FakeCourseEnrollmentRepository(),
        principal(ADMIN_ID, [RoleCode.ADMIN], ['enrollments.self_read']),
      ),
    )
      .get('/api/v1/me/enrollments')
      .expect(403);
    await request(
      createApp(
        new FakeCourseEnrollmentRepository(),
        principal(STUDENT_ID, [RoleCode.STUDENT], []),
      ),
    )
      .get('/api/v1/me/enrollments')
      .expect(403);
  });

  it('lists only the authenticated student records with pagination aliases', async () => {
    const repository = new FakeCourseEnrollmentRepository([createEnrollmentRecord()]);
    const app = createApp(
      repository,
      principal(STUDENT_ID, [RoleCode.STUDENT], ['enrollments.self_read']),
    );
    const response = await request(app)
      .get('/api/v1/me/enrollments?limit=5&status=ACTIVE')
      .expect(200);
    expect(response.body.data.pagination).toMatchObject({ page: 1, pageSize: 5, totalItems: 1 });
    expect(response.body.data.items[0]).not.toHaveProperty('createdById');
    expect(response.body.data.items[0].course).not.toHaveProperty('teacherId');
    expect(repository.lastListQuery).toMatchObject({
      studentId: STUDENT_ID,
      status: CourseEnrollmentStatus.ACTIVE,
    });
  });

  it('allows a student to cancel their active enrollment using POST or PATCH', async () => {
    for (const method of ['post', 'patch'] as const) {
      const repository = new FakeCourseEnrollmentRepository([createEnrollmentRecord()]);
      const app = createApp(
        repository,
        principal(STUDENT_ID, [RoleCode.STUDENT], ['enrollments.self_cancel']),
      );
      const path = `/api/v1/me/enrollments/${ENROLLMENT_ID}/cancel`;
      const operation = method === 'post' ? request(app).post(path) : request(app).patch(path);
      const response = await operation.expect(200);
      expect(response.body.data.status).toBe(CourseEnrollmentStatus.CANCELLED);
    }
  });

  it('allows a manager to create, list, read, and transition enrollment', async () => {
    const repository = new FakeCourseEnrollmentRepository();
    const app = createApp(
      repository,
      principal(
        ADMIN_ID,
        [RoleCode.ADMIN],
        ['enrollments.create', 'enrollments.read', 'enrollments.update_status'],
      ),
    );
    await request(app)
      .post(`/api/v1/courses/${COURSE_ID}/enrollments`)
      .send({ studentId: STUDENT_ID })
      .expect(201)
      .expect((response) => {
        expect(response.body.data).toHaveProperty('createdById', ADMIN_ID);
        expect(response.body.data.course).toHaveProperty('teacherId');
      });
    await request(app).get(`/api/v1/courses/${COURSE_ID}/enrollments`).expect(200);
    await request(app).get(`/api/v1/enrollments/${ENROLLMENT_ID}`).expect(200);
    const response = await request(app)
      .patch(`/api/v1/enrollments/${ENROLLMENT_ID}/status`)
      .send({ status: CourseEnrollmentStatus.COMPLETED })
      .expect(200);
    expect(response.body.data.status).toBe(CourseEnrollmentStatus.COMPLETED);
  });

  it('rejects a student from privileged enrollment routes', async () => {
    const app = createApp(
      new FakeCourseEnrollmentRepository([createEnrollmentRecord()]),
      principal(
        STUDENT_ID,
        [RoleCode.STUDENT],
        ['enrollments.create', 'enrollments.read', 'enrollments.update_status'],
      ),
    );
    await request(app).get(`/api/v1/courses/${COURSE_ID}/enrollments`).expect(403);
    await request(app).get(`/api/v1/enrollments/${ENROLLMENT_ID}`).expect(403);
    await request(app)
      .patch(`/api/v1/enrollments/${ENROLLMENT_ID}/status`)
      .send({ status: CourseEnrollmentStatus.SUSPENDED })
      .expect(403);
  });

  it('rejects invalid identifiers, status values, and unknown query fields', async () => {
    const app = createApp(
      new FakeCourseEnrollmentRepository(),
      principal(ADMIN_ID, [RoleCode.ADMIN], ['enrollments.read', 'enrollments.update_status']),
    );
    await request(app).get('/api/v1/enrollments/not-a-uuid').expect(422);
    await request(app)
      .patch(`/api/v1/enrollments/${ENROLLMENT_ID}/status`)
      .send({ status: 'PAUSED' })
      .expect(422);
    await request(app).get(`/api/v1/courses/${COURSE_ID}/enrollments?unsafe=true`).expect(422);
  });
});
