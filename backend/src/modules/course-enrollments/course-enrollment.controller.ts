import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { AppError } from '../../utils/app-error.js';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types.js';
import {
  presentManagedEnrollment,
  presentManagedEnrollmentPage,
  presentSelfEnrollment,
  presentSelfEnrollmentPage,
} from './course-enrollment.presenter.js';
import {
  courseIdParamsSchema,
  createManagedEnrollmentSchema,
  createSelfEnrollmentSchema,
  enrollmentIdParamsSchema,
  listCourseEnrollmentsQuerySchema,
  listOwnEnrollmentsQuerySchema,
  updateEnrollmentStatusSchema,
} from './course-enrollment.schemas.js';
import type { CourseEnrollmentUseCases } from './course-enrollment.service.js';
import type { EnrollmentActor, EnrollmentAuditContext } from './course-enrollment.types.js';

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

function actorFrom(principal: AuthenticatedPrincipal): EnrollmentActor {
  return {
    userId: principal.userId,
    roles: principal.roles,
    permissions: principal.permissions,
  };
}

function auditContext(request: Request, principal: AuthenticatedPrincipal): EnrollmentAuditContext {
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

export class CourseEnrollmentController {
  constructor(private readonly enrollments: CourseEnrollmentUseCases) {}

  selfEnroll = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { courseId } = courseIdParamsSchema.parse(request.params);
    createSelfEnrollmentSchema.parse(request.body ?? {});
    const result = await this.enrollments.selfEnroll(
      courseId,
      actorFrom(principal),
      auditContext(request, principal),
    );
    response
      .status(201)
      .location(`/api/v1/me/enrollments/${result.id}`)
      .json({
        success: true,
        message: 'Kursga enrollment qilindi.',
        data: presentSelfEnrollment(result),
      });
  };

  createManaged = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { courseId } = courseIdParamsSchema.parse(request.params);
    const { studentId } = createManagedEnrollmentSchema.parse(request.body);
    const result = await this.enrollments.createManaged(
      courseId,
      studentId,
      actorFrom(principal),
      auditContext(request, principal),
    );
    response
      .status(201)
      .location(`/api/v1/enrollments/${result.id}`)
      .json({
        success: true,
        message: 'Talaba kursga enrollment qilindi.',
        data: presentManagedEnrollment(result),
      });
  };

  listOwn = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const query = listOwnEnrollmentsQuerySchema.parse(request.query);
    const result = await this.enrollments.listOwn(query, actorFrom(principal));
    response.status(200).json({
      success: true,
      message: 'Enrollmentlar ro‘yxati olindi.',
      data: presentSelfEnrollmentPage(result),
    });
  };

  getOwn = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { enrollmentId } = enrollmentIdParamsSchema.parse(request.params);
    const result = await this.enrollments.getOwn(enrollmentId, actorFrom(principal));
    response.status(200).json({
      success: true,
      message: 'Enrollment ma’lumotlari olindi.',
      data: presentSelfEnrollment(result),
    });
  };

  cancelOwn = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { enrollmentId } = enrollmentIdParamsSchema.parse(request.params);
    const result = await this.enrollments.cancelOwn(
      enrollmentId,
      actorFrom(principal),
      auditContext(request, principal),
    );
    response.status(200).json({
      success: true,
      message: 'Enrollment bekor qilindi.',
      data: presentSelfEnrollment(result),
    });
  };

  listCourse = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { courseId } = courseIdParamsSchema.parse(request.params);
    const query = listCourseEnrollmentsQuerySchema.parse(request.query);
    const result = await this.enrollments.listCourse(courseId, query, actorFrom(principal));
    response.status(200).json({
      success: true,
      message: 'Kurs enrollmentlari olindi.',
      data: presentManagedEnrollmentPage(result),
    });
  };

  getManaged = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { enrollmentId } = enrollmentIdParamsSchema.parse(request.params);
    const result = await this.enrollments.getManaged(enrollmentId, actorFrom(principal));
    response.status(200).json({
      success: true,
      message: 'Enrollment ma’lumotlari olindi.',
      data: presentManagedEnrollment(result),
    });
  };

  updateStatus = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { enrollmentId } = enrollmentIdParamsSchema.parse(request.params);
    const { status } = updateEnrollmentStatusSchema.parse(request.body);
    const result = await this.enrollments.updateStatus(
      enrollmentId,
      status,
      actorFrom(principal),
      auditContext(request, principal),
    );
    response.status(200).json({
      success: true,
      message: 'Enrollment holati yangilandi.',
      data: presentManagedEnrollment(result),
    });
  };
}
