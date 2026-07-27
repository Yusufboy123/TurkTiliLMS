import { RoleCode, SessionClientType } from '@prisma/client';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { errorHandler } from '../../src/middlewares/error-handler.middleware.js';
import {
  requirePermission,
  requireRole,
} from '../../src/modules/authorization/authorization.middleware.js';
import type { AuthenticatedPrincipal } from '../../src/modules/authorization/authorization.types.js';
import { ProgressTrackingController } from '../../src/modules/progress-tracking/progress-tracking.controller.js';
import { createProgressTrackingRouter } from '../../src/modules/progress-tracking/progress-tracking.routes.js';
import { ProgressTrackingService } from '../../src/modules/progress-tracking/progress-tracking.service.js';
import { AppError } from '../../src/utils/app-error.js';
import {
  BLOCK_ID,
  ENROLLMENT_ID,
  LESSON_ID,
  STUDENT_ID,
  FakeProgressTrackingRepository,
} from '../helpers/progress-tracking-fakes.js';

const IDEMPOTENCY_KEY = '019d0000-0000-7000-8000-000000000201';
const allPermissions = [
  'progress.self_read',
  'progress.self_complete',
  'progress.self_reopen',
  'progress.self_record_visit',
];

function principal(
  roles: RoleCode[] = [RoleCode.STUDENT],
  permissions: string[] = allPermissions,
): AuthenticatedPrincipal {
  return {
    userId: STUDENT_ID,
    sessionId: '019d0000-0000-7000-8000-000000000202',
    clientType: SessionClientType.WEB,
    roles,
    permissions,
  };
}

function authenticationMiddleware(value: AuthenticatedPrincipal | null): RequestHandler {
  return (incomingRequest, _response, next) => {
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
    (incomingRequest as typeof incomingRequest & { auth?: AuthenticatedPrincipal }).auth = value;
    next();
  };
}

function createApp(
  repository: FakeProgressTrackingRepository,
  authenticatedPrincipal: AuthenticatedPrincipal | null = principal(),
): express.Express {
  const controller = new ProgressTrackingController(new ProgressTrackingService(repository));
  const passThrough: RequestHandler = (_request, _response, next) => next();
  const router = createProgressTrackingRouter({
    controller,
    authentication: authenticationMiddleware(authenticatedPrincipal),
    studentRole: requireRole(RoleCode.STUDENT),
    permission: requirePermission,
    blockMutationLimit: passThrough,
    lessonMutationLimit: passThrough,
    activityLimit: passThrough,
  });
  const app = express();
  app.use(express.json());
  app.use('/api/v1', router);
  app.get('/api/v1/unrelated-module', (_request, response) => {
    response.status(204).end();
  });
  app.use(errorHandler);
  return app;
}

describe('Progress tracking routes', () => {
  it('exposes all approved Module 8.2 read endpoints', async () => {
    const app = createApp(new FakeProgressTrackingRepository());
    await request(app).get('/api/v1/me/progress?activeLimit=5').expect(200);
    await request(app).get('/api/v1/me/progress/completed-courses').expect(200);
    const progress = await request(app)
      .get(`/api/v1/me/enrollments/${ENROLLMENT_ID}/progress`)
      .expect(200);
    expect(progress.body.data).not.toHaveProperty('studentId');
    expect(progress.body.data).not.toHaveProperty('progressRoot');
    await request(app).get(`/api/v1/me/enrollments/${ENROLLMENT_ID}/progress/resume`).expect(200);
  });

  it('requires authentication, STUDENT role, and the route permission', async () => {
    await request(createApp(new FakeProgressTrackingRepository(), null))
      .get('/api/v1/me/progress')
      .expect(401);
    await request(createApp(new FakeProgressTrackingRepository(), principal([RoleCode.ADMIN])))
      .get('/api/v1/me/progress')
      .expect(403);
    await request(
      createApp(new FakeProgressTrackingRepository(), principal([RoleCode.STUDENT], [])),
    )
      .get('/api/v1/me/progress')
      .expect(403);
  });

  it('validates query, UUID, body, and Idempotency-Key boundaries', async () => {
    const app = createApp(new FakeProgressTrackingRepository());
    await request(app).get('/api/v1/me/progress?activeLimit=11').expect(422);
    await request(app).get('/api/v1/me/enrollments/not-a-uuid/progress').expect(422);
    await request(app)
      .post(`/api/v1/me/enrollments/${ENROLLMENT_ID}/progress/blocks/${BLOCK_ID}/complete`)
      .send({ expectedCompletionVersion: 0, curriculumVersion: 1 })
      .expect(422);
    await request(app)
      .post(`/api/v1/me/enrollments/${ENROLLMENT_ID}/progress/blocks/${BLOCK_ID}/complete`)
      .set('Idempotency-Key', IDEMPOTENCY_KEY)
      .send({ expectedCompletionVersion: 0, curriculumVersion: 1, extra: true })
      .expect(422);
  });

  it('completes and replays a block with the documented response header', async () => {
    const repository = new FakeProgressTrackingRepository();
    const app = createApp(repository);
    const path = `/api/v1/me/enrollments/${ENROLLMENT_ID}/progress/blocks/${BLOCK_ID}/complete`;
    const first = await request(app)
      .post(path)
      .set('Idempotency-Key', IDEMPOTENCY_KEY)
      .send({ expectedCompletionVersion: 0, curriculumVersion: 1 })
      .expect(200);
    expect(first.headers['idempotency-replayed']).toBe('false');
    expect(first.body.data).toMatchObject({ changed: true, completionVersion: 1 });

    const replay = await request(app)
      .post(path)
      .set('Idempotency-Key', IDEMPOTENCY_KEY)
      .send({ expectedCompletionVersion: 0, curriculumVersion: 1 })
      .expect(200);
    expect(replay.headers['idempotency-replayed']).toBe('true');
    expect(replay.body).toEqual(first.body);
  });

  it('records a last visited lesson through the approved PUT endpoint', async () => {
    const response = await request(createApp(new FakeProgressTrackingRepository()))
      .put(`/api/v1/me/enrollments/${ENROLLMENT_ID}/progress/last-visited-lesson`)
      .set('Idempotency-Key', IDEMPOTENCY_KEY)
      .send({ lessonId: LESSON_ID, curriculumVersion: 1 })
      .expect(200);
    expect(response.body.data).toMatchObject({
      activityVersion: 1,
      completionVersion: 0,
      lastVisitedLessonId: LESSON_ID,
    });
  });

  it('uses distinct complete and reopen permissions at both route and service boundaries', async () => {
    const completeOnly = createApp(
      new FakeProgressTrackingRepository(),
      principal([RoleCode.STUDENT], ['progress.self_complete']),
    );
    await request(completeOnly)
      .post(`/api/v1/me/enrollments/${ENROLLMENT_ID}/progress/blocks/${BLOCK_ID}/reopen`)
      .set('Idempotency-Key', IDEMPOTENCY_KEY)
      .send({ expectedCompletionVersion: 0, curriculumVersion: 1 })
      .expect(403);

    const reopenOnly = createApp(
      new FakeProgressTrackingRepository(),
      principal([RoleCode.STUDENT], ['progress.self_reopen']),
    );
    await request(reopenOnly)
      .post(`/api/v1/me/enrollments/${ENROLLMENT_ID}/progress/blocks/${BLOCK_ID}/complete`)
      .set('Idempotency-Key', IDEMPOTENCY_KEY)
      .send({ expectedCompletionVersion: 0, curriculumVersion: 1 })
      .expect(403);
  });

  it('does not expose future Module 8.4 reporting endpoints', async () => {
    const app = createApp(new FakeProgressTrackingRepository());
    await request(app).get('/api/v1/progress').expect(404);
    await request(app).get('/api/v1/courses/some-course/progress').expect(404);
  });

  it('does not apply progress authentication or STUDENT role checks to unrelated routes', async () => {
    await request(createApp(new FakeProgressTrackingRepository(), null))
      .get('/api/v1/unrelated-module')
      .expect(204);
    await request(createApp(new FakeProgressTrackingRepository(), principal([RoleCode.ADMIN], [])))
      .get('/api/v1/unrelated-module')
      .expect(204);
  });
});
