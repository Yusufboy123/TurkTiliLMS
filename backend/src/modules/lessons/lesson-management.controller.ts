import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { AppError } from '../../utils/app-error.js';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types.js';
import { courseSlugSchema } from '../courses/course.schemas.js';
import {
  catalogLessonParamsSchema,
  courseParamsSchema,
  createLessonSchema,
  createSectionSchema,
  deleteContentSchema,
  lessonListSchema,
  lessonParamsSchema,
  lessonPositionSchema,
  lessonStatusSchema,
  lessonTeacherSchema,
  positionSchema,
  sectionParamsSchema,
  updateLessonSchema,
  updateSectionSchema,
} from './lesson-management.schemas.js';
import type { LessonManagementService } from './lesson-management.service.js';
import type { ContentActor, ContentAuditContext } from './lesson-management.types.js';

function principal(request: Request): AuthenticatedPrincipal {
  const value = (request as Request & { auth?: AuthenticatedPrincipal }).auth;
  if (!value)
    throw new AppError(
      'Davom etish uchun tizimga kirish talab qilinadi.',
      401,
      'AUTHENTICATION_REQUIRED',
    );
  return value;
}
function optionalPrincipal(request: Request): AuthenticatedPrincipal | null {
  return (request as Request & { auth?: AuthenticatedPrincipal }).auth ?? null;
}
function actor(value: AuthenticatedPrincipal): ContentActor {
  return { userId: value.userId, roles: value.roles, permissions: value.permissions };
}
function audit(request: Request, value: AuthenticatedPrincipal): ContentAuditContext {
  const requestId = request.header('x-request-id');
  const validRequestId = requestId && /^[0-9a-f-]{36}$/iu.test(requestId) ? requestId : undefined;
  const userAgent = request.header('user-agent')?.slice(0, 512);
  const ipHash = request.ip ? createHash('sha256').update(request.ip).digest('hex') : undefined;
  return {
    actorUserId: value.userId,
    ...(validRequestId ? { requestCorrelationId: validRequestId } : {}),
    ...(ipHash ? { ipHash } : {}),
    ...(userAgent ? { userAgentSummary: userAgent } : {}),
  };
}

export class LessonManagementController {
  constructor(private readonly service: LessonManagementService) {}

  listSections = async (req: Request, res: Response) => {
    const auth = principal(req);
    const { courseId } = courseParamsSchema.parse(req.params);
    res.status(200).json({
      success: true,
      message: 'Kurs bo‘limlari olindi.',
      data: await this.service.listSections(courseId, actor(auth)),
    });
  };
  sectionDetail = async (req: Request, res: Response) => {
    const auth = principal(req);
    const { courseId, sectionId } = sectionParamsSchema.parse(req.params);
    res.status(200).json({
      success: true,
      message: 'Kurs bo‘limi olindi.',
      data: await this.service.sectionDetail(courseId, sectionId, actor(auth)),
    });
  };
  createSection = async (req: Request, res: Response) => {
    const auth = principal(req);
    const { courseId } = courseParamsSchema.parse(req.params);
    const input = createSectionSchema.parse(req.body);
    const data = await this.service.createSection(courseId, input, actor(auth), audit(req, auth));
    res
      .location(`/api/v1/courses/${courseId}/sections/${data.id}`)
      .status(201)
      .json({ success: true, message: 'Kurs bo‘limi yaratildi.', data });
  };
  updateSection = async (req: Request, res: Response) => {
    const auth = principal(req);
    const { courseId, sectionId } = sectionParamsSchema.parse(req.params);
    const input = updateSectionSchema.parse(req.body);
    res.status(200).json({
      success: true,
      message: 'Kurs bo‘limi yangilandi.',
      data: await this.service.updateSection(
        courseId,
        sectionId,
        input,
        actor(auth),
        audit(req, auth),
      ),
    });
  };
  reorderSection = async (req: Request, res: Response) => {
    const auth = principal(req);
    const { courseId, sectionId } = sectionParamsSchema.parse(req.params);
    const { position } = positionSchema.parse(req.body);
    res.status(200).json({
      success: true,
      message: 'Kurs bo‘limi tartibi yangilandi.',
      data: await this.service.reorderSection(
        courseId,
        sectionId,
        position,
        actor(auth),
        audit(req, auth),
      ),
    });
  };
  deleteSection = async (req: Request, res: Response) => {
    const auth = principal(req);
    const { courseId, sectionId } = sectionParamsSchema.parse(req.params);
    deleteContentSchema.parse(req.body);
    await this.service.deleteSection(courseId, sectionId, actor(auth), audit(req, auth));
    res.status(200).json({ success: true, message: 'Kurs bo‘limi o‘chirildi.' });
  };
  restoreSection = async (req: Request, res: Response) => {
    const auth = principal(req);
    const { courseId, sectionId } = sectionParamsSchema.parse(req.params);
    res.status(200).json({
      success: true,
      message: 'Kurs bo‘limi tiklandi.',
      data: await this.service.restoreSection(courseId, sectionId, actor(auth), audit(req, auth)),
    });
  };
  listLessons = async (req: Request, res: Response) => {
    const auth = principal(req);
    const { courseId } = courseParamsSchema.parse(req.params);
    const query = lessonListSchema.parse(req.query);
    res.status(200).json({
      success: true,
      message: 'Darslar ro‘yxati olindi.',
      data: await this.service.listLessons(courseId, query, actor(auth)),
    });
  };
  statistics = async (req: Request, res: Response) => {
    const auth = principal(req);
    const { courseId } = courseParamsSchema.parse(req.params);
    res.status(200).json({
      success: true,
      message: 'Darslar statistikasi olindi.',
      data: await this.service.lessonStatistics(courseId, actor(auth)),
    });
  };
  lessonDetail = async (req: Request, res: Response) => {
    const auth = principal(req);
    const { courseId, lessonId } = lessonParamsSchema.parse(req.params);
    res.status(200).json({
      success: true,
      message: 'Dars ma’lumotlari olindi.',
      data: await this.service.lessonDetail(courseId, lessonId, actor(auth)),
    });
  };
  createLesson = async (req: Request, res: Response) => {
    const auth = principal(req);
    const { courseId } = courseParamsSchema.parse(req.params);
    const input = createLessonSchema.parse(req.body);
    const data = await this.service.createLesson(courseId, input, actor(auth), audit(req, auth));
    res
      .location(`/api/v1/courses/${courseId}/lessons/${data.id}`)
      .status(201)
      .json({ success: true, message: 'Dars yaratildi.', data });
  };
  updateLesson = async (req: Request, res: Response) => {
    const auth = principal(req);
    const { courseId, lessonId } = lessonParamsSchema.parse(req.params);
    const input = updateLessonSchema.parse(req.body);
    res.status(200).json({
      success: true,
      message: 'Dars yangilandi.',
      data: await this.service.updateLesson(
        courseId,
        lessonId,
        input,
        actor(auth),
        audit(req, auth),
      ),
    });
  };
  updateLessonStatus = async (req: Request, res: Response) => {
    const auth = principal(req);
    const { courseId, lessonId } = lessonParamsSchema.parse(req.params);
    const { status } = lessonStatusSchema.parse(req.body);
    res.status(200).json({
      success: true,
      message: 'Dars holati yangilandi.',
      data: await this.service.updateLessonStatus(
        courseId,
        lessonId,
        status,
        actor(auth),
        audit(req, auth),
      ),
    });
  };
  assignTeacher = async (req: Request, res: Response) => {
    const auth = principal(req);
    const { courseId, lessonId } = lessonParamsSchema.parse(req.params);
    const { teacherId } = lessonTeacherSchema.parse(req.body);
    res.status(200).json({
      success: true,
      message: 'Dars o‘qituvchisi yangilandi.',
      data: await this.service.assignLessonTeacher(
        courseId,
        lessonId,
        teacherId,
        actor(auth),
        audit(req, auth),
      ),
    });
  };
  reorderLesson = async (req: Request, res: Response) => {
    const auth = principal(req);
    const { courseId, lessonId } = lessonParamsSchema.parse(req.params);
    const input = lessonPositionSchema.parse(req.body);
    res.status(200).json({
      success: true,
      message: 'Dars tartibi yangilandi.',
      data: await this.service.reorderLesson(
        courseId,
        lessonId,
        input.sectionId,
        input.position,
        actor(auth),
        audit(req, auth),
      ),
    });
  };
  deleteLesson = async (req: Request, res: Response) => {
    const auth = principal(req);
    const { courseId, lessonId } = lessonParamsSchema.parse(req.params);
    deleteContentSchema.parse(req.body);
    await this.service.deleteLesson(courseId, lessonId, actor(auth), audit(req, auth));
    res.status(200).json({ success: true, message: 'Dars o‘chirildi.' });
  };
  restoreLesson = async (req: Request, res: Response) => {
    const auth = principal(req);
    const { courseId, lessonId } = lessonParamsSchema.parse(req.params);
    res.status(200).json({
      success: true,
      message: 'Dars tiklandi va DRAFT holatiga qaytarildi.',
      data: await this.service.restoreLesson(courseId, lessonId, actor(auth), audit(req, auth)),
    });
  };
  curriculum = async (req: Request, res: Response) => {
    const { slug } = zCourseSlug(req.params);
    res.status(200).json({
      success: true,
      message: 'Kurs dasturi olindi.',
      data: await this.service.curriculum(slug),
    });
  };
  catalogLesson = async (req: Request, res: Response) => {
    const { courseSlug, lessonSlug } = catalogLessonParamsSchema.parse(req.params);
    res.status(200).json({
      success: true,
      message: 'Dars olindi.',
      data: await this.service.catalogLesson(courseSlug, lessonSlug, optionalPrincipal(req)),
    });
  };
}

function zCourseSlug(params: unknown): { slug: string } {
  const parsed = courseSlugSchema
    .transform((slug) => ({ slug }))
    .safeParse((params as { slug?: unknown }).slug);
  if (!parsed.success) throw parsed.error;
  return parsed.data;
}
