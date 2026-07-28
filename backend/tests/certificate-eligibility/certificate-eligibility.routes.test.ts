import { RoleCode, SessionClientType } from '@prisma/client';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { errorHandler } from '../../src/middlewares/error-handler.middleware.js';
import {
  requirePermission,
  requireRole,
} from '../../src/modules/authorization/authorization.middleware.js';
import type { AuthenticatedPrincipal } from '../../src/modules/authorization/authorization.types.js';
import { CertificateEligibilityController } from '../../src/modules/certificate-eligibility/certificate-eligibility.controller.js';
import { createCertificateEligibilityRouter } from '../../src/modules/certificate-eligibility/certificate-eligibility.routes.js';
import type { CertificateEligibilityUseCases } from '../../src/modules/certificate-eligibility/certificate-eligibility.service.js';
import { AppError } from '../../src/utils/app-error.js';

const STUDENT_ID = '019d0000-0000-7000-8000-000000000401';
const TEACHER_ID = '019d0000-0000-7000-8000-000000000402';
const COURSE_ID = '019d0000-0000-7000-8000-000000000403';
const ENROLLMENT_ID = '019d0000-0000-7000-8000-000000000404';

function principal(
  userId: string,
  roles: RoleCode[],
  permissions: string[],
): AuthenticatedPrincipal {
  return {
    userId,
    sessionId: '019d0000-0000-7000-8000-000000000405',
    clientType: SessionClientType.WEB,
    roles,
    permissions,
  };
}

const capabilities = {
  canReadEligibility: true,
  canReadCertificateStatus: true,
  canIssueCertificate: false as const,
  canRevokeCertificate: false as const,
};

function createApp(auth: AuthenticatedPrincipal | null) {
  const eligibility = {
    enrollmentId: ENROLLMENT_ID,
    course: { id: COURSE_ID, title: 'A1', slug: 'a1' },
    completion: {
      status: 'NOT_COMPLETED' as const,
      completedAt: null,
      completionCurriculumVersion: null,
      completionVersion: null,
      completedLessons: 0,
      totalEligibleLessons: 1,
      percentage: 0,
    },
    eligibility: {
      id: null,
      status: 'NOT_COMPLETED' as const,
      policyCode: null,
      policyVersion: null,
      evaluationVersion: null,
      evaluatedAt: null,
      reasonCodes: ['COURSE_NOT_COMPLETED'],
    },
    capabilities,
  };
  const status = {
    enrollmentId: ENROLLMENT_ID,
    course: eligibility.course,
    status: 'NOT_ISSUED' as const,
    certificate: null,
    capabilities,
  };
  const service: CertificateEligibilityUseCases = {
    getOwnEligibility: vi.fn().mockResolvedValue(eligibility),
    getOwnCertificateStatus: vi.fn().mockResolvedValue(status),
    getCourseEligibility: vi.fn().mockResolvedValue(eligibility),
    getCourseCertificateStatus: vi.fn().mockResolvedValue(status),
  };
  const authentication: RequestHandler = (incoming, _response, next) => {
    if (!auth) {
      next(new AppError('Tizimga kiring.', 401, 'AUTHENTICATION_REQUIRED'));
      return;
    }
    (incoming as typeof incoming & { auth?: AuthenticatedPrincipal }).auth = auth;
    next();
  };
  const passThrough: RequestHandler = (_request, _response, next) => next();
  const app = express();
  app.use(
    '/api/v1',
    createCertificateEligibilityRouter({
      controller: new CertificateEligibilityController(service),
      authentication,
      studentRole: requireRole(RoleCode.STUDENT),
      teacherOrAdminRole: requireRole(RoleCode.TEACHER, RoleCode.ADMIN),
      permission: requirePermission,
      rateLimiter: passThrough,
    }),
  );
  app.use(errorHandler);
  return { app, service };
}

describe('Certificate eligibility routes', () => {
  it('exposes the two student read endpoints', async () => {
    const { app } = createApp(
      principal(
        STUDENT_ID,
        [RoleCode.STUDENT],
        ['certificate_eligibility.self_read', 'certificates.self_read'],
      ),
    );
    await request(app)
      .get(`/api/v1/me/enrollments/${ENROLLMENT_ID}/certificate-eligibility`)
      .expect(200);
    await request(app)
      .get(`/api/v1/me/enrollments/${ENROLLMENT_ID}/certificate-status`)
      .expect(200);
  });

  it('exposes the two teacher/admin course reads and forwards the path scope', async () => {
    const { app, service } = createApp(
      principal(
        TEACHER_ID,
        [RoleCode.TEACHER],
        ['certificate_eligibility.course_read', 'certificates.course_read'],
      ),
    );
    await request(app)
      .get(`/api/v1/courses/${COURSE_ID}/enrollments/${ENROLLMENT_ID}/certificate-eligibility`)
      .expect(200);
    await request(app)
      .get(`/api/v1/courses/${COURSE_ID}/enrollments/${ENROLLMENT_ID}/certificate-status`)
      .expect(200);
    expect(service.getCourseEligibility).toHaveBeenCalledWith(
      COURSE_ID,
      ENROLLMENT_ID,
      expect.objectContaining({ userId: TEACHER_ID }),
      expect.objectContaining({ actorUserId: TEACHER_ID }),
    );
  });

  it('requires authentication, role, permission, and valid UUID parameters', async () => {
    await request(createApp(null).app)
      .get(`/api/v1/me/enrollments/${ENROLLMENT_ID}/certificate-eligibility`)
      .expect(401);
    await request(createApp(principal(STUDENT_ID, [RoleCode.STUDENT], [])).app)
      .get(`/api/v1/me/enrollments/${ENROLLMENT_ID}/certificate-eligibility`)
      .expect(403);
    await request(
      createApp(principal(STUDENT_ID, [RoleCode.STUDENT], ['certificate_eligibility.self_read']))
        .app,
    )
      .get('/api/v1/me/enrollments/not-a-uuid/certificate-eligibility')
      .expect(422);
  });

  it('does not expose the future issuance or revocation mutations', async () => {
    const { app } = createApp(
      principal(TEACHER_ID, [RoleCode.ADMIN], ['certificates.issue', 'certificates.revoke']),
    );

    await request(app).post(`/api/v1/enrollments/${ENROLLMENT_ID}/certificates`).expect(404);
    await request(app)
      .post('/api/v1/certificates/019d0000-0000-7000-8000-000000000406/revoke')
      .expect(404);
  });
});
