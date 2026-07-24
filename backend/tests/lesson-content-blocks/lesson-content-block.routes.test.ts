import { LessonContentBlockType, LessonType, RoleCode, SessionClientType } from '@prisma/client';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { errorHandler } from '../../src/middlewares/error-handler.middleware.js';
import {
  requirePermission,
  requireRole,
} from '../../src/modules/authorization/authorization.middleware.js';
import type { AuthenticatedPrincipal } from '../../src/modules/authorization/authorization.types.js';
import { LessonContentBlockController } from '../../src/modules/lesson-content-blocks/lesson-content-block.controller.js';
import {
  createLessonContentBlockCatalogRouter,
  createLessonContentBlockRouter,
} from '../../src/modules/lesson-content-blocks/lesson-content-block.routes.js';
import { LessonContentBlockService } from '../../src/modules/lesson-content-blocks/lesson-content-block.service.js';
import { MetadataOnlyLessonContentBlockDelivery } from '../../src/modules/lesson-content-blocks/lesson-content-block.storage.js';
import {
  EnrollmentPendingLessonAccessPolicy,
  LessonManagementService,
} from '../../src/modules/lessons/lesson-management.service.js';
import { AppError } from '../../src/utils/app-error.js';
import {
  BLOCK_ONE_ID,
  FakeLessonContentBlockRepository,
} from '../helpers/lesson-content-block-fakes.js';
import {
  COURSE_ADMIN_ID,
  COURSE_TEACHER_ID,
  createCourseRecord,
  FakeCourseRepository,
  TEST_COURSE_ID,
} from '../helpers/course-fakes.js';
import { FakeLessonRepository, LESSON_ID, SECTION_ID } from '../helpers/lesson-fakes.js';

const SESSION_ID = '019b9e23-bde8-7342-a46e-c682ab77d88f';

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
    (
      incomingRequest as typeof incomingRequest & {
        auth?: AuthenticatedPrincipal;
      }
    ).auth = principal;
    next();
  };
}

function principal(roles: RoleCode[], permissions: string[]): AuthenticatedPrincipal {
  return {
    userId: roles.includes(RoleCode.TEACHER) ? COURSE_TEACHER_ID : COURSE_ADMIN_ID,
    sessionId: SESSION_ID,
    clientType: SessionClientType.WEB,
    roles,
    permissions,
  };
}

function createTestApp(
  authenticatedUser: AuthenticatedPrincipal | null,
  course = createCourseRecord(),
) {
  const blocks = new FakeLessonContentBlockRepository();
  const lessons = new FakeLessonRepository();
  const lessonService = new LessonManagementService(
    lessons,
    new FakeCourseRepository([course]),
    new EnrollmentPendingLessonAccessPolicy(),
  );
  const service = new LessonContentBlockService(
    blocks,
    lessonService,
    new MetadataOnlyLessonContentBlockDelivery(),
  );
  const controller = new LessonContentBlockController(service);
  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1/courses/:courseId/lessons/:lessonId/blocks',
    createLessonContentBlockRouter({
      controller,
      authentication: authentication(authenticatedUser),
      managementRole: requireRole(RoleCode.ADMIN, RoleCode.TEACHER),
      permission: requirePermission,
    }),
  );
  app.use(
    '/api/v1/catalog/courses',
    createLessonContentBlockCatalogRouter(controller, (_request, _response, next) => next()),
  );
  app.use(errorHandler);
  return { app, blocks, lessons };
}

describe('Lesson content block management routes', () => {
  it('rejects unauthenticated management requests', async () => {
    const { app } = createTestApp(null);

    const response = await request(app)
      .get(`/api/v1/courses/${TEST_COURSE_ID}/lessons/${LESSON_ID}/blocks`)
      .expect(401);

    expect(response.body.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it.each([
    [RoleCode.ADMIN, COURSE_ADMIN_ID],
    [RoleCode.TEACHER, COURSE_TEACHER_ID],
  ])('allows an authorized %s to create a block', async (role, userId) => {
    const { app, blocks } = createTestApp(principal([role], ['lesson_blocks.create']));

    const response = await request(app)
      .post(`/api/v1/courses/${TEST_COURSE_ID}/lessons/${LESSON_ID}/blocks`)
      .send({
        blockType: LessonContentBlockType.TEXT,
        textContent: 'Yangi dars matni',
      })
      .expect(201);

    expect(response.body.message).toBe('Dars kontent bloki yaratildi.');
    expect(blocks.lastCreateData?.createdById).toBe(userId);
  });

  it('denies a teacher on an unrelated course', async () => {
    const { app } = createTestApp(
      principal([RoleCode.TEACHER], ['lesson_blocks.read']),
      createCourseRecord({
        teacher: {
          id: '019b9e23-ceaa-717c-a55e-c33697209467',
          firstName: null,
          lastName: null,
          displayName: null,
        },
      }),
    );

    const response = await request(app)
      .get(`/api/v1/courses/${TEST_COURSE_ID}/lessons/${LESSON_ID}/blocks`)
      .expect(403);

    expect(response.body.code).toBe('COURSE_SCOPE_DENIED');
  });

  it('denies students from management routes', async () => {
    const { app } = createTestApp(principal([RoleCode.STUDENT], ['lesson_blocks.read']));

    const response = await request(app)
      .get(`/api/v1/courses/${TEST_COURSE_ID}/lessons/${LESSON_ID}/blocks`)
      .expect(403);

    expect(response.body.code).toBe('ACCESS_DENIED');
  });

  it('requires the explicit endpoint permission', async () => {
    const { app } = createTestApp(principal([RoleCode.ADMIN], []));

    const response = await request(app)
      .get(`/api/v1/courses/${TEST_COURSE_ID}/lessons/${LESSON_ID}/blocks`)
      .expect(403);

    expect(response.body.code).toBe('ACCESS_DENIED');
  });

  it('validates block content before service persistence', async () => {
    const { app, blocks } = createTestApp(principal([RoleCode.ADMIN], ['lesson_blocks.create']));

    const response = await request(app)
      .post(`/api/v1/courses/${TEST_COURSE_ID}/lessons/${LESSON_ID}/blocks`)
      .send({ blockType: LessonContentBlockType.PDF })
      .expect(422);

    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(blocks.lastCreateData).toBeNull();
  });

  it('requires confirmation for deletion', async () => {
    const { app } = createTestApp(principal([RoleCode.ADMIN], ['lesson_blocks.delete']));

    const response = await request(app)
      .delete(`/api/v1/courses/${TEST_COURSE_ID}/lessons/${LESSON_ID}/blocks/${BLOCK_ONE_ID}`)
      .send({ confirmation: false })
      .expect(422);

    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('protects visibility with its dedicated permission', async () => {
    const { app } = createTestApp(principal([RoleCode.TEACHER], ['lesson_blocks.update']));

    const response = await request(app)
      .patch(
        `/api/v1/courses/${TEST_COURSE_ID}/lessons/${LESSON_ID}/blocks/${BLOCK_ONE_ID}/visibility`,
      )
      .send({ isVisible: false })
      .expect(403);

    expect(response.body.code).toBe('ACCESS_DENIED');
  });

  it('supports the complete authorized management lifecycle', async () => {
    const permissions = [
      'lesson_blocks.read',
      'lesson_blocks.update',
      'lesson_blocks.reorder',
      'lesson_blocks.manage_visibility',
      'lesson_blocks.delete',
      'lesson_blocks.restore',
    ];
    const { app, blocks } = createTestApp(principal([RoleCode.ADMIN], permissions));
    const basePath = `/api/v1/courses/${TEST_COURSE_ID}/lessons/${LESSON_ID}/blocks`;

    await request(app)
      .get(basePath)
      .query({
        blockType: LessonContentBlockType.TEXT,
        isVisible: 'true',
        isRequired: 'true',
      })
      .expect(200);
    expect(blocks.lastListQuery).toMatchObject({
      blockType: LessonContentBlockType.TEXT,
      isVisible: true,
      isRequired: true,
    });

    await request(app).get(`${basePath}/${BLOCK_ONE_ID}`).expect(200);
    await request(app)
      .patch(`${basePath}/${BLOCK_ONE_ID}`)
      .send({ title: 'Yangilangan blok' })
      .expect(200);
    await request(app)
      .patch(`${basePath}/${BLOCK_ONE_ID}/position`)
      .send({ position: 1 })
      .expect(200);
    await request(app)
      .patch(`${basePath}/${BLOCK_ONE_ID}/visibility`)
      .send({ isVisible: false })
      .expect(200);
    await request(app)
      .delete(`${basePath}/${BLOCK_ONE_ID}`)
      .send({ confirmation: true })
      .expect(200);
    await request(app).post(`${basePath}/${BLOCK_ONE_ID}/restore`).send({}).expect(200);
  });
});

describe('Lesson content block catalog route', () => {
  it('returns safe blocks for a public preview lesson', async () => {
    const { app, lessons } = createTestApp(null);
    lessons.catalogLessonResult = {
      id: LESSON_ID,
      courseId: TEST_COURSE_ID,
      title: 'Preview dars',
      slug: 'preview-dars',
      summary: null,
      content: null,
      lessonType: LessonType.TEXT,
      durationMinutes: 10,
      isPreview: true,
      publishedAt: new Date(),
      section: { id: SECTION_ID, title: 'Kirish' },
    };

    const response = await request(app)
      .get('/api/v1/catalog/courses/turk-tili-a1/lessons/preview-dars/blocks')
      .expect(200);

    expect(response.body.data[0]).not.toHaveProperty('createdById');
    expect(response.body.data[0]).not.toHaveProperty('metadata');
    expect(response.body.data[0]).not.toHaveProperty('deletedAt');
  });

  it('keeps non-preview lesson content protected', async () => {
    const { app, lessons } = createTestApp(null);
    lessons.catalogLessonResult = {
      id: LESSON_ID,
      courseId: TEST_COURSE_ID,
      title: 'Yopiq dars',
      slug: 'yopiq-dars',
      summary: null,
      content: null,
      lessonType: LessonType.TEXT,
      durationMinutes: 10,
      isPreview: false,
      publishedAt: new Date(),
      section: { id: SECTION_ID, title: 'Kirish' },
    };

    const response = await request(app)
      .get('/api/v1/catalog/courses/turk-tili-a1/lessons/yopiq-dars/blocks')
      .expect(401);

    expect(response.body.code).toBe('LESSON_AUTHENTICATION_REQUIRED');
  });
});
