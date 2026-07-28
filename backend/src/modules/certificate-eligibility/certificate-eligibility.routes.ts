import { RoleCode } from '@prisma/client';
import { Router, type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  requireAuthentication,
  requirePermission,
  requireRole,
} from '../authorization/authorization.middleware.js';
import { certificateEligibilityController } from './certificate-eligibility.container.js';
import type { CertificateEligibilityController } from './certificate-eligibility.controller.js';

const certificateReadRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Juda ko\u2018p so\u2018rov yuborildi. Birozdan so\u2018ng qayta urinib ko\u2018ring.',
  },
});

interface CertificateEligibilityRouterDependencies {
  controller: CertificateEligibilityController;
  authentication: RequestHandler;
  studentRole: RequestHandler;
  teacherOrAdminRole: RequestHandler;
  permission: (...permissions: string[]) => RequestHandler;
  rateLimiter: RequestHandler;
}

export function createCertificateEligibilityRouter(
  dependencies: CertificateEligibilityRouterDependencies,
): Router {
  const router = Router();

  router.get(
    '/me/enrollments/:enrollmentId/certificate-eligibility',
    dependencies.authentication,
    dependencies.studentRole,
    dependencies.permission('certificate_eligibility.self_read'),
    dependencies.rateLimiter,
    asyncHandler(dependencies.controller.getOwnEligibility),
  );
  router.get(
    '/me/enrollments/:enrollmentId/certificate-status',
    dependencies.authentication,
    dependencies.studentRole,
    dependencies.permission('certificates.self_read'),
    dependencies.rateLimiter,
    asyncHandler(dependencies.controller.getOwnCertificateStatus),
  );
  router.get(
    '/courses/:courseId/enrollments/:enrollmentId/certificate-eligibility',
    dependencies.authentication,
    dependencies.teacherOrAdminRole,
    dependencies.permission('certificate_eligibility.course_read'),
    dependencies.rateLimiter,
    asyncHandler(dependencies.controller.getCourseEligibility),
  );
  router.get(
    '/courses/:courseId/enrollments/:enrollmentId/certificate-status',
    dependencies.authentication,
    dependencies.teacherOrAdminRole,
    dependencies.permission('certificates.course_read'),
    dependencies.rateLimiter,
    asyncHandler(dependencies.controller.getCourseCertificateStatus),
  );

  return router;
}

export const certificateEligibilityRouter = createCertificateEligibilityRouter({
  controller: certificateEligibilityController,
  authentication: requireAuthentication,
  studentRole: requireRole(RoleCode.STUDENT),
  teacherOrAdminRole: requireRole(RoleCode.ADMIN, RoleCode.TEACHER),
  permission: requirePermission,
  rateLimiter: certificateReadRateLimiter,
});
