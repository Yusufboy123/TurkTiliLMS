import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { AppError } from '../../utils/app-error.js';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types.js';
import {
  courseEligibilityParamsSchema,
  eligibilityEnrollmentParamsSchema,
} from './certificate-eligibility.schemas.js';
import type { CertificateEligibilityUseCases } from './certificate-eligibility.service.js';
import type {
  CertificateEligibilityActor,
  CertificateEligibilityAuditContext,
} from './certificate-eligibility.types.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function principalFrom(request: Request): AuthenticatedPrincipal {
  const principal = (request as Request & { auth?: AuthenticatedPrincipal }).auth;
  if (!principal) {
    throw new AppError(
      'Davom etish uchun tizimga kirish talab qilinadi.',
      401,
      'AUTHENTICATION_REQUIRED',
    );
  }
  return principal;
}

function actorFrom(principal: AuthenticatedPrincipal): CertificateEligibilityActor {
  return {
    userId: principal.userId,
    roles: principal.roles,
    permissions: principal.permissions,
  };
}

function auditContext(
  request: Request,
  principal: AuthenticatedPrincipal,
): CertificateEligibilityAuditContext {
  const requestId = request.header('x-request-id');
  const userAgent = request.header('user-agent')?.slice(0, 512);
  const ipHash = request.ip ? createHash('sha256').update(request.ip).digest('hex') : undefined;
  return {
    actorUserId: principal.userId,
    ...(requestId && uuidPattern.test(requestId) ? { requestCorrelationId: requestId } : {}),
    ...(ipHash ? { ipHash } : {}),
    ...(userAgent ? { userAgentSummary: userAgent } : {}),
  };
}

export class CertificateEligibilityController {
  constructor(private readonly service: CertificateEligibilityUseCases) {}

  getOwnEligibility = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { enrollmentId } = eligibilityEnrollmentParamsSchema.parse(request.params);
    const data = await this.service.getOwnEligibility(enrollmentId, actorFrom(principal));
    response.status(200).json({
      success: true,
      message: 'Sertifikatga muvofiqlik holati olindi.',
      data,
    });
  };

  getOwnCertificateStatus = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { enrollmentId } = eligibilityEnrollmentParamsSchema.parse(request.params);
    const data = await this.service.getOwnCertificateStatus(enrollmentId, actorFrom(principal));
    response.status(200).json({
      success: true,
      message: 'Sertifikat holati olindi.',
      data,
    });
  };

  getCourseEligibility = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { courseId, enrollmentId } = courseEligibilityParamsSchema.parse(request.params);
    const data = await this.service.getCourseEligibility(
      courseId,
      enrollmentId,
      actorFrom(principal),
      auditContext(request, principal),
    );
    response.status(200).json({
      success: true,
      message: 'Sertifikatga muvofiqlik holati olindi.',
      data,
    });
  };

  getCourseCertificateStatus = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { courseId, enrollmentId } = courseEligibilityParamsSchema.parse(request.params);
    const data = await this.service.getCourseCertificateStatus(
      courseId,
      enrollmentId,
      actorFrom(principal),
      auditContext(request, principal),
    );
    response.status(200).json({
      success: true,
      message: 'Sertifikat holati olindi.',
      data,
    });
  };
}
