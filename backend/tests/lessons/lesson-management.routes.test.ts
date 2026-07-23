import { LessonType, RoleCode, SessionClientType } from '@prisma/client';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { errorHandler } from '../../src/middlewares/error-handler.middleware.js';
import {
  requirePermission,
  requireRole,
} from '../../src/modules/authorization/authorization.middleware.js';
import type { AuthenticatedPrincipal } from '../../src/modules/authorization/authorization.types.js';
import { LessonManagementController } from '../../src/modules/lessons/lesson-management.controller.js';
import {
  createLessonCatalogRouter,
  createLessonRouter,
  createSectionRouter,
} from '../../src/modules/lessons/lesson-management.routes.js';
import {
  EnrollmentPendingLessonAccessPolicy,
  LessonManagementService,
} from '../../src/modules/lessons/lesson-management.service.js';
import { AppError } from '../../src/utils/app-error.js';
import {
  COURSE_ADMIN_ID,
  COURSE_TEACHER_ID,
  FakeCourseRepository,
  TEST_COURSE_ID,
} from '../helpers/course-fakes.js';
import { FakeLessonRepository, LESSON_ID, SECTION_ID } from '../helpers/lesson-fakes.js';

const SESSION_ID = '019b9e23-2b46-7a86-83dd-86c5b451c52b';

function authentication(principal: AuthenticatedPrincipal | null): RequestHandler {
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

function authenticatedPrincipal(roles: RoleCode[], permissions: string[]): AuthenticatedPrincipal {
  return {
    userId: roles.includes(RoleCode.TEACHER) ? COURSE_TEACHER_ID : COURSE_ADMIN_ID,
    sessionId: SESSION_ID,
    clientType: SessionClientType.WEB,
    roles,
    permissions,
  };
}

function createTestApp(
  lessons: FakeLessonRepository,
  principal: AuthenticatedPrincipal | null,
): express.Express {
  const service = new LessonManagementService(
    lessons,
    new FakeCourseRepository(),
    new EnrollmentPendingLessonAccessPolicy(),
  );
  const controller = new LessonManagementController(service);
  const app = express();
  app.use(express.json());

  const dependencies = {
    controller,
    authentication: authentication(principal),
    managementRole: requireRole(RoleCode.ADMIN, RoleCode.TEACHER),
    adminRole: requireRole(RoleCode.ADMIN),
    permission: requirePermission,
  };

  app.use('/api/v1/courses/:courseId/sections', createSectionRouter(dependencies));
  app.use('/api/v1/courses/:courseId/lessons', createLessonRouter(dependencies));
  app.use(
    '/api/v1/catalog/courses',
    createLessonCatalogRouter(controller, (_request, _response, next) => next()),
  );
  app.use(errorHandler);

  return app;
}

describe('Course section and lesson routes', () => {
  it('rejects unauthenticated management requests', async () => {
    const lessons = new FakeLessonRepository();
    const app = createTestApp(lessons, null);

    const response = await request(app)
      .get(`/api/v1/courses/${TEST_COURSE_ID}/sections`)
      .expect(401);

    expect(response.body.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('forbids students from management endpoints', async () => {
    const lessons = new FakeLessonRepository();
    const app = createTestApp(
      lessons,
      authenticatedPrincipal([RoleCode.STUDENT], ['sections.read']),
    );

    const response = await request(app)
      .get(`/api/v1/courses/${TEST_COURSE_ID}/sections`)
      .expect(403);

    expect(response.body.code).toBe('ACCESS_DENIED');
  });

  it('validates lesson creation input before calling the repository', async () => {
    const lessons = new FakeLessonRepository();
    const app = createTestApp(
      lessons,
      authenticatedPrincipal([RoleCode.TEACHER], ['lessons.create']),
    );

    const response = await request(app)
      .post(`/api/v1/courses/${TEST_COURSE_ID}/lessons`)
      .send({
        sectionId: 'not-a-uuid',
        title: 'x',
        lessonType: 'UNSUPPORTED',
      })
      .expect(422);

    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(lessons.lastCreateLesson).toBeNull();
  });

  it('allows a permitted teacher to create a section and a lesson', async () => {
    const lessons = new FakeLessonRepository();
    const app = createTestApp(
      lessons,
      authenticatedPrincipal([RoleCode.TEACHER], ['sections.create', 'lessons.create']),
    );

    const sectionResponse = await request(app)
      .post(`/api/v1/courses/${TEST_COURSE_ID}/sections`)
      .send({ title: 'Asosiy mavzular' })
      .expect(201);

    expect(sectionResponse.body.message).toBe('Kurs bo‘limi yaratildi.');

    const lessonResponse = await request(app)
      .post(`/api/v1/courses/${TEST_COURSE_ID}/lessons`)
      .send({
        sectionId: SECTION_ID,
        title: 'Salomlashish',
        lessonType: LessonType.TEXT,
      })
      .expect(201);

    expect(lessonResponse.body.message).toBe('Dars yaratildi.');
    expect(lessons.lastCreateLesson).toMatchObject({
      teacherId: COURSE_TEACHER_ID,
      lessonType: LessonType.TEXT,
    });
  });

  it('keeps published curriculum metadata public', async () => {
    const lessons = new FakeLessonRepository();
    lessons.curriculumResult = {
      course: {
        id: TEST_COURSE_ID,
        title: 'Turk tili A1',
        slug: 'turk-tili-a1',
      },
      sections: [
        {
          id: SECTION_ID,
          title: 'Kirish',
          description: null,
          position: 1,
          lessons: [
            {
              id: LESSON_ID,
              title: 'Salomlashish',
              slug: 'salomlashish',
              lessonType: LessonType.TEXT,
              position: 1,
              durationMinutes: 10,
              isPreview: true,
            },
          ],
        },
      ],
    };
    const app = createTestApp(lessons, null);

    const response = await request(app)
      .get('/api/v1/catalog/courses/turk-tili-a1/curriculum')
      .expect(200);

    expect(response.body.data.sections[0].lessons[0]).toMatchObject({
      slug: 'salomlashish',
      isPreview: true,
    });
    expect(response.body.data.sections[0].lessons[0]).not.toHaveProperty('content');
  });

  it('allows public preview lessons and fails closed for protected lessons', async () => {
    const lessons = new FakeLessonRepository();
    lessons.catalogLessonResult = {
      id: LESSON_ID,
      courseId: TEST_COURSE_ID,
      title: 'Salomlashish',
      slug: 'salomlashish',
      summary: null,
      content: 'Dars mazmuni',
      lessonType: LessonType.TEXT,
      durationMinutes: 10,
      isPreview: true,
      publishedAt: new Date('2026-01-01T00:00:00.000Z'),
      section: { id: SECTION_ID, title: 'Kirish' },
    };
    const app = createTestApp(lessons, null);

    await request(app).get('/api/v1/catalog/courses/turk-tili-a1/lessons/salomlashish').expect(200);

    lessons.catalogLessonResult = {
      ...lessons.catalogLessonResult,
      isPreview: false,
    };

    const protectedResponse = await request(app)
      .get('/api/v1/catalog/courses/turk-tili-a1/lessons/salomlashish')
      .expect(401);

    expect(protectedResponse.body.code).toBe('LESSON_AUTHENTICATION_REQUIRED');
  });

  it('restricts lesson teacher assignment to admins', async () => {
    const lessons = new FakeLessonRepository();
    const app = createTestApp(
      lessons,
      authenticatedPrincipal([RoleCode.TEACHER], ['lessons.assign_teacher']),
    );

    const response = await request(app)
      .patch(`/api/v1/courses/${TEST_COURSE_ID}/lessons/${LESSON_ID}/teacher`)
      .send({ teacherId: COURSE_TEACHER_ID })
      .expect(403);

    expect(response.body.code).toBe('ACCESS_DENIED');
  });
});
