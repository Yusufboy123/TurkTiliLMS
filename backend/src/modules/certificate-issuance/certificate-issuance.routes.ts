import { RoleCode } from '@prisma/client';
import { Router, type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  requireAuthentication,
  requirePermission,
  requireRole,
} from '../authorization/authorization.middleware.js';
import { certificateIssuanceController } from './certificate-issuance.container.js';
import type { CertificateIssuanceController } from './certificate-issuance.controller.js';

function limiter(windowMs: number, limit: number): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message:
        'Juda ko\u2018p so\u2018rov yuborildi. Birozdan so\u2018ng qayta urinib ko\u2018ring.',
    },
  });
}

const issueRateLimiter = limiter(15 * 60_000, 5);
const detailRateLimiter = limiter(60_000, 60);
const downloadRateLimiter = limiter(60_000, 20);

export interface CertificateIssuanceRouterDependencies {
  readonly controller: CertificateIssuanceController;
  readonly authentication: RequestHandler;
  readonly adminRole: RequestHandler;
  readonly studentRole: RequestHandler;
  readonly teacherOrAdminRole: RequestHandler;
  readonly permission: (...permissions: string[]) => RequestHandler;
  readonly issueRateLimiter: RequestHandler;
  readonly detailRateLimiter: RequestHandler;
  readonly downloadRateLimiter: RequestHandler;
}

export function createCertificateIssuanceRouter(
  dependencies: CertificateIssuanceRouterDependencies,
): Router {
  const router = Router();

  router.post(
    '/enrollments/:enrollmentId/certificates',
    dependencies.authentication,
    dependencies.adminRole,
    dependencies.permission('certificates.issue'),
    dependencies.issueRateLimiter,
    asyncHandler(dependencies.controller.issueCertificate),
  );
  router.get(
    '/me/certificates/:certificateId',
    dependencies.authentication,
    dependencies.studentRole,
    dependencies.permission('certificates.self_read'),
    dependencies.detailRateLimiter,
    asyncHandler(dependencies.controller.getOwnCertificate),
  );
  router.get(
    '/me/certificates/:certificateId/download',
    dependencies.authentication,
    dependencies.studentRole,
    dependencies.permission('certificates.self_download'),
    dependencies.downloadRateLimiter,
    asyncHandler(dependencies.controller.downloadOwnCertificate),
  );
  router.get(
    '/courses/:courseId/certificates/:certificateId',
    dependencies.authentication,
    dependencies.teacherOrAdminRole,
    dependencies.permission('certificates.course_read'),
    dependencies.detailRateLimiter,
    asyncHandler(dependencies.controller.getCourseCertificate),
  );
  router.get(
    '/courses/:courseId/certificates/:certificateId/download',
    dependencies.authentication,
    dependencies.adminRole,
    dependencies.permission('certificates.download'),
    dependencies.downloadRateLimiter,
    asyncHandler(dependencies.controller.downloadCourseCertificate),
  );

  return router;
}

export const certificateIssuanceRouter = createCertificateIssuanceRouter({
  controller: certificateIssuanceController,
  authentication: requireAuthentication,
  adminRole: requireRole(RoleCode.ADMIN),
  studentRole: requireRole(RoleCode.STUDENT),
  teacherOrAdminRole: requireRole(RoleCode.ADMIN, RoleCode.TEACHER),
  permission: requirePermission,
  issueRateLimiter,
  detailRateLimiter,
  downloadRateLimiter,
});
