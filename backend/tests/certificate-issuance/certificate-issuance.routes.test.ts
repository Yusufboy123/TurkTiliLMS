import { CertificateLifecycleStatus, RoleCode, SessionClientType } from '@prisma/client';
import express, { type RequestHandler } from 'express';
import { Readable } from 'node:stream';
import request from 'supertest';
import { errorHandler } from '../../src/middlewares/error-handler.middleware.js';
import {
  requirePermission,
  requireRole,
} from '../../src/modules/authorization/authorization.middleware.js';
import type { AuthenticatedPrincipal } from '../../src/modules/authorization/authorization.types.js';
import { CertificateIssuanceController } from '../../src/modules/certificate-issuance/certificate-issuance.controller.js';
import { createCertificateIssuanceRouter } from '../../src/modules/certificate-issuance/certificate-issuance.routes.js';
import type { CertificateIssuanceUseCases } from '../../src/modules/certificate-issuance/certificate-issuance.service.js';
import { AppError } from '../../src/utils/app-error.js';

const ADMIN_ID = '019d0000-0000-7000-8000-000000000821';
const STUDENT_ID = '019d0000-0000-7000-8000-000000000822';
const TEACHER_ID = '019d0000-0000-7000-8000-000000000823';
const SESSION_ID = '019d0000-0000-7000-8000-000000000824';
const COURSE_ID = '019d0000-0000-7000-8000-000000000825';
const ENROLLMENT_ID = '019d0000-0000-7000-8000-000000000826';
const EVALUATION_ID = '019d0000-0000-7000-8000-000000000827';
const CERTIFICATE_ID = '019d0000-0000-7000-8000-000000000828';
const PDF = Buffer.from('%PDF-1.7\n%%EOF\n');

function principal(
  userId: string,
  roles: RoleCode[],
  permissions: string[],
): AuthenticatedPrincipal {
  return {
    userId,
    sessionId: SESSION_ID,
    clientType: SessionClientType.WEB,
    roles,
    permissions,
  };
}

function fakeService(): CertificateIssuanceUseCases {
  const certificate = {
    id: CERTIFICATE_ID,
    certificateNumber: 'TTL-2026-0000000001',
    enrollmentId: ENROLLMENT_ID,
    course: { id: COURSE_ID, title: 'A1', slug: 'a1' },
    recipientDisplayName: 'O\u2018quvchi',
    organizationName: 'Turk Tili LMS',
    locale: 'uz-Latn',
    status: CertificateLifecycleStatus.ISSUED,
    version: 1,
    issuedAt: '2026-07-29T08:30:00.000Z',
    revokedAt: null,
    safeRevocationReasonCode: null,
    templateVersion: 1,
    artifact: { available: true, mimeType: 'application/pdf' as const, sizeBytes: PDF.length },
    capabilities: {
      canDownload: true,
      canIssue: false,
      canRevoke: false,
      canReissue: false as const,
    },
  };
  const download = {
    certificateId: CERTIFICATE_ID,
    certificateNumber: 'TTL-2026-0000000001',
    mimeType: 'application/pdf' as const,
    contentLength: PDF.length,
    checksum: 'a'.repeat(64),
    stream: Readable.from([PDF]),
  };
  return {
    issueCertificate: vi.fn().mockResolvedValue({
      location: `/api/v1/courses/${COURSE_ID}/certificates/${CERTIFICATE_ID}`,
      response: {
        success: true,
        message: 'Sertifikat muvaffaqiyatli berildi.',
        data: {
          operation: 'ISSUE',
          certificateId: CERTIFICATE_ID,
          enrollmentId: ENROLLMENT_ID,
          certificateNumber: 'TTL-2026-0000000001',
          resultingStatus: 'ISSUED',
          resultingVersion: 1,
          occurredAt: '2026-07-29T08:30:00.000Z',
        },
      },
    }),
    getOwnCertificate: vi.fn().mockResolvedValue(certificate),
    getCourseCertificate: vi.fn().mockResolvedValue(certificate),
    downloadOwnCertificate: vi.fn().mockImplementation(async () => ({
      ...download,
      stream: Readable.from([PDF]),
    })),
    downloadCourseCertificate: vi.fn().mockImplementation(async () => ({
      ...download,
      stream: Readable.from([PDF]),
    })),
  };
}

function createApp(auth: AuthenticatedPrincipal | null) {
  const service = fakeService();
  const authentication: RequestHandler = (incoming, _response, next) => {
    if (!auth) {
      next(new AppError('Tizimga kiring.', 401, 'AUTHENTICATION_REQUIRED'));
      return;
    }
    (incoming as typeof incoming & { auth?: AuthenticatedPrincipal }).auth = auth;
    next();
  };
  const pass: RequestHandler = (_request, _response, next) => next();
  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1',
    createCertificateIssuanceRouter({
      controller: new CertificateIssuanceController(service),
      authentication,
      adminRole: requireRole(RoleCode.ADMIN),
      studentRole: requireRole(RoleCode.STUDENT),
      teacherOrAdminRole: requireRole(RoleCode.TEACHER, RoleCode.ADMIN),
      permission: requirePermission,
      issueRateLimiter: pass,
      detailRateLimiter: pass,
      downloadRateLimiter: pass,
    }),
  );
  app.use(errorHandler);
  return { app, service };
}

function issueRequest(app: express.Express) {
  return request(app)
    .post(`/api/v1/enrollments/${ENROLLMENT_ID}/certificates`)
    .set('Idempotency-Key', 'issue-1')
    .set('X-Step-Up-Proof', 'A'.repeat(43))
    .send({
      eligibilityEvaluationId: EVALUATION_ID,
      eligibilityEvaluationVersion: 1,
      completionVersion: 7,
      curriculumVersion: 3,
      confirmed: true,
    });
}

describe('certificate issuance routes', () => {
  it('exposes issuance with required headers and returns Location', async () => {
    const { app, service } = createApp(
      principal(ADMIN_ID, [RoleCode.ADMIN], ['certificates.issue']),
    );
    const response = await issueRequest(app).expect(201);
    expect(response.headers.location).toBe(
      `/api/v1/courses/${COURSE_ID}/certificates/${CERTIFICATE_ID}`,
    );
    expect(service.issueCertificate).toHaveBeenCalledWith(
      expect.objectContaining({
        enrollmentId: ENROLLMENT_ID,
        idempotencyKey: 'issue-1',
        stepUpProof: 'A'.repeat(43),
      }),
      expect.objectContaining({ userId: ADMIN_ID, sessionId: SESSION_ID }),
      expect.objectContaining({ actorUserId: ADMIN_ID }),
    );
  });

  it('requires authentication, ADMIN role, permission, valid headers, and exact body', async () => {
    await issueRequest(createApp(null).app).expect(401);
    await issueRequest(
      createApp(principal(TEACHER_ID, [RoleCode.TEACHER], ['certificates.issue'])).app,
    ).expect(403);
    await issueRequest(createApp(principal(ADMIN_ID, [RoleCode.ADMIN], [])).app).expect(403);

    const valid = createApp(principal(ADMIN_ID, [RoleCode.ADMIN], ['certificates.issue'])).app;
    await request(valid)
      .post(`/api/v1/enrollments/${ENROLLMENT_ID}/certificates`)
      .send({})
      .expect(422);
    await request(valid)
      .post(`/api/v1/enrollments/${ENROLLMENT_ID}/certificates`)
      .set('Idempotency-Key', 'issue-1')
      .set('X-Step-Up-Proof', 'short')
      .send({
        eligibilityEvaluationId: EVALUATION_ID,
        eligibilityEvaluationVersion: 1,
        completionVersion: 7,
        curriculumVersion: 3,
        confirmed: true,
      })
      .expect(422);
  });

  it('exposes student-owned detail and verified stored PDF download headers', async () => {
    const { app } = createApp(
      principal(
        STUDENT_ID,
        [RoleCode.STUDENT],
        ['certificates.self_read', 'certificates.self_download'],
      ),
    );
    await request(app).get(`/api/v1/me/certificates/${CERTIFICATE_ID}`).expect(200);
    const response = await request(app)
      .get(`/api/v1/me/certificates/${CERTIFICATE_ID}/download`)
      .expect(200);
    expect(response.headers['content-type']).toMatch(/^application\/pdf/u);
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="turk-tili-sertifikat-TTL-2026-0000000001.pdf"',
    );
    expect(response.headers['content-length']).toBe(String(PDF.length));
    expect(response.headers.etag).toBe(`"sha256-${'a'.repeat(64)}"`);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('exposes teacher/admin scoped detail while keeping course download ADMIN-only', async () => {
    const teacherApp = createApp(
      principal(TEACHER_ID, [RoleCode.TEACHER], ['certificates.course_read']),
    ).app;
    await request(teacherApp)
      .get(`/api/v1/courses/${COURSE_ID}/certificates/${CERTIFICATE_ID}`)
      .expect(200);
    await request(teacherApp)
      .get(`/api/v1/courses/${COURSE_ID}/certificates/${CERTIFICATE_ID}/download`)
      .expect(403);

    const adminApp = createApp(
      principal(ADMIN_ID, [RoleCode.ADMIN], ['certificates.course_read', 'certificates.download']),
    ).app;
    await request(adminApp)
      .get(`/api/v1/courses/${COURSE_ID}/certificates/${CERTIFICATE_ID}/download`)
      .expect(200);
  });

  it('does not expose revoke, public verification, or reissue runtime', async () => {
    const app = createApp(
      principal(
        ADMIN_ID,
        [RoleCode.ADMIN],
        ['certificates.issue', 'certificates.revoke', 'certificates.download'],
      ),
    ).app;
    await request(app).post(`/api/v1/certificates/${CERTIFICATE_ID}/revoke`).expect(404);
    await request(app).get('/api/v1/public/certificates/verify/raw-token').expect(404);
    await request(app).post(`/api/v1/certificates/${CERTIFICATE_ID}/reissue`).expect(404);
  });
});
