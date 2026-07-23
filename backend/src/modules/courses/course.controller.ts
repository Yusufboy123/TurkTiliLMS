import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { AppError } from '../../utils/app-error.js';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types.js';
import {
  assignCourseTeacherSchema,
  courseIdParamsSchema,
  courseSlugParamsSchema,
  createCourseSchema,
  deleteCourseSchema,
  listCatalogCoursesQuerySchema,
  listCoursesQuerySchema,
  updateCourseSchema,
  updateCourseStatusSchema,
} from './course.schemas.js';
import type { CourseManagementUseCases } from './course.service.js';
import type { CourseActor, CourseAuditContext } from './course.types.js';

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

function actorFrom(principal: AuthenticatedPrincipal): CourseActor {
  return {
    userId: principal.userId,
    roles: principal.roles,
    permissions: principal.permissions,
  };
}

function auditContext(request: Request, principal: AuthenticatedPrincipal): CourseAuditContext {
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

export class CourseController {
  constructor(private readonly courses: CourseManagementUseCases) {}

  list = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const query = listCoursesQuerySchema.parse(request.query);
    const result = await this.courses.list(query, actorFrom(principal));

    response.status(200).json({
      success: true,
      message: 'Kurslar ro‘yxati olindi.',
      data: result,
    });
  };

  statistics = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const result = await this.courses.statistics(actorFrom(principal));

    response.status(200).json({
      success: true,
      message: 'Kurslar statistikasi olindi.',
      data: result,
    });
  };

  getById = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { courseId } = courseIdParamsSchema.parse(request.params);
    const result = await this.courses.getById(courseId, actorFrom(principal));

    response.status(200).json({
      success: true,
      message: 'Kurs ma’lumotlari olindi.',
      data: result,
    });
  };

  create = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const input = createCourseSchema.parse(request.body);
    const result = await this.courses.create(
      input,
      actorFrom(principal),
      auditContext(request, principal),
    );

    response.location(`/api/v1/courses/${result.id}`).status(201).json({
      success: true,
      message: 'Kurs yaratildi.',
      data: result,
    });
  };

  update = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { courseId } = courseIdParamsSchema.parse(request.params);
    const input = updateCourseSchema.parse(request.body);
    const result = await this.courses.update(
      courseId,
      input,
      actorFrom(principal),
      auditContext(request, principal),
    );

    response.status(200).json({
      success: true,
      message: 'Kurs ma’lumotlari yangilandi.',
      data: result,
    });
  };

  updateStatus = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { courseId } = courseIdParamsSchema.parse(request.params);
    const { status } = updateCourseStatusSchema.parse(request.body);
    const result = await this.courses.updateStatus(
      courseId,
      status,
      actorFrom(principal),
      auditContext(request, principal),
    );

    response.status(200).json({
      success: true,
      message: 'Kurs holati yangilandi.',
      data: result,
    });
  };

  assignTeacher = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { courseId } = courseIdParamsSchema.parse(request.params);
    const { teacherId } = assignCourseTeacherSchema.parse(request.body);
    const result = await this.courses.assignTeacher(
      courseId,
      teacherId,
      actorFrom(principal),
      auditContext(request, principal),
    );

    response.status(200).json({
      success: true,
      message: teacherId ? 'Kursga o‘qituvchi biriktirildi.' : 'Kurs o‘qituvchisi olib tashlandi.',
      data: result,
    });
  };

  delete = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { courseId } = courseIdParamsSchema.parse(request.params);
    deleteCourseSchema.parse(request.body);
    await this.courses.delete(courseId, actorFrom(principal), auditContext(request, principal));

    response.status(200).json({
      success: true,
      message: 'Kurs o‘chirildi. Uni keyinroq tiklash mumkin.',
    });
  };

  restore = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { courseId } = courseIdParamsSchema.parse(request.params);
    const result = await this.courses.restore(
      courseId,
      actorFrom(principal),
      auditContext(request, principal),
    );

    response.status(200).json({
      success: true,
      message: 'Kurs tiklandi va DRAFT holatiga qaytarildi.',
      data: result,
    });
  };

  listCatalog = async (request: Request, response: Response): Promise<void> => {
    const query = listCatalogCoursesQuerySchema.parse(request.query);
    const result = await this.courses.listCatalog(query);

    response.status(200).json({
      success: true,
      message: 'Kurslar katalogi olindi.',
      data: result,
    });
  };

  getCatalogBySlug = async (request: Request, response: Response): Promise<void> => {
    const { slug } = courseSlugParamsSchema.parse(request.params);
    const result = await this.courses.getCatalogBySlug(slug);

    response.status(200).json({
      success: true,
      message: 'Kurs ma’lumotlari olindi.',
      data: result,
    });
  };
}
