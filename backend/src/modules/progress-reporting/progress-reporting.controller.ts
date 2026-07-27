import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { AppError } from '../../utils/app-error.js';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types.js';
import {
  adminProgressReportingQuerySchema,
  reportingEnrollmentParamsSchema,
  teacherProgressReportingQuerySchema,
  teacherReportingDetailParamsSchema,
  reportingCourseParamsSchema,
} from './progress-reporting.schemas.js';
import type { ProgressReportingUseCases } from './progress-reporting.service.js';
import type { ProgressReportingActor, ReportingAuditContext } from './progress-reporting.types.js';

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

function actorFrom(principal: AuthenticatedPrincipal): ProgressReportingActor {
  return {
    userId: principal.userId,
    roles: principal.roles,
    permissions: principal.permissions,
  };
}

function auditContext(request: Request, principal: AuthenticatedPrincipal): ReportingAuditContext {
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

export class ProgressReportingController {
  constructor(private readonly reporting: ProgressReportingUseCases) {}

  listTeacherCourse = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { courseId } = reportingCourseParamsSchema.parse(request.params);
    const query = teacherProgressReportingQuerySchema.parse(request.query);
    const data = await this.reporting.listTeacherCourse(
      courseId,
      query,
      actorFrom(principal),
      auditContext(request, principal),
    );
    response.status(200).json({
      success: true,
      message: 'Kurs o‘zlashtirish ma’lumotlari olindi.',
      data,
    });
  };

  getTeacherEnrollment = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { courseId, enrollmentId } = teacherReportingDetailParamsSchema.parse(request.params);
    const data = await this.reporting.getTeacherEnrollment(
      courseId,
      enrollmentId,
      actorFrom(principal),
      auditContext(request, principal),
    );
    response.status(200).json({
      success: true,
      message: 'Talabaning o‘zlashtirish ma’lumotlari olindi.',
      data,
    });
  };

  listAdmin = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const query = adminProgressReportingQuerySchema.parse(request.query);
    const data = await this.reporting.listAdmin(
      query,
      actorFrom(principal),
      auditContext(request, principal),
    );
    response.status(200).json({
      success: true,
      message: 'O‘zlashtirish ma’lumotlari olindi.',
      data,
    });
  };

  getAdminEnrollment = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { enrollmentId } = reportingEnrollmentParamsSchema.parse(request.params);
    const data = await this.reporting.getAdminEnrollment(
      enrollmentId,
      actorFrom(principal),
      auditContext(request, principal),
    );
    response.status(200).json({
      success: true,
      message: 'Talabaning o‘zlashtirish ma’lumotlari olindi.',
      data,
    });
  };
}
