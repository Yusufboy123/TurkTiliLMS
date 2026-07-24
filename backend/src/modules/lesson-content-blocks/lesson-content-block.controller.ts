import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { AppError } from '../../utils/app-error.js';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types.js';
import {
  createLessonContentBlockSchema,
  deleteLessonContentBlockSchema,
  lessonBlockCatalogParamsSchema,
  lessonBlockParamsSchema,
  lessonBlockParentParamsSchema,
  lessonContentBlockListSchema,
  lessonContentBlockPositionSchema,
  lessonContentBlockVisibilitySchema,
  restoreLessonContentBlockSchema,
  updateLessonContentBlockSchema,
} from './lesson-content-block.schemas.js';
import type { LessonContentBlockService } from './lesson-content-block.service.js';
import type { LessonBlockActor, LessonBlockAuditContext } from './lesson-content-block.types.js';

function authenticatedPrincipal(request: Request): AuthenticatedPrincipal {
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

function optionalPrincipal(request: Request): AuthenticatedPrincipal | null {
  return (request as Request & { auth?: AuthenticatedPrincipal }).auth ?? null;
}

function actor(principal: AuthenticatedPrincipal): LessonBlockActor {
  return {
    userId: principal.userId,
    roles: principal.roles,
    permissions: principal.permissions,
  };
}

function auditContext(
  request: Request,
  principal: AuthenticatedPrincipal,
  courseId: string,
): LessonBlockAuditContext {
  const requestId = request.header('x-request-id');
  const userAgent = request.header('user-agent')?.slice(0, 512);
  const ipHash = request.ip ? createHash('sha256').update(request.ip).digest('hex') : undefined;
  return {
    actorUserId: principal.userId,
    courseId,
    ...(requestId && /^[0-9a-f-]{36}$/iu.test(requestId)
      ? { requestCorrelationId: requestId }
      : {}),
    ...(ipHash ? { ipHash } : {}),
    ...(userAgent ? { userAgentSummary: userAgent } : {}),
  };
}

export class LessonContentBlockController {
  constructor(private readonly service: LessonContentBlockService) {}

  list = async (request: Request, response: Response): Promise<void> => {
    const principal = authenticatedPrincipal(request);
    const { courseId, lessonId } = lessonBlockParentParamsSchema.parse(request.params);
    const query = lessonContentBlockListSchema.parse(request.query);
    response.status(200).json({
      success: true,
      message: 'Dars kontent bloklari olindi.',
      data: await this.service.list(courseId, lessonId, query, actor(principal)),
    });
  };

  detail = async (request: Request, response: Response): Promise<void> => {
    const principal = authenticatedPrincipal(request);
    const { courseId, lessonId, blockId } = lessonBlockParamsSchema.parse(request.params);
    response.status(200).json({
      success: true,
      message: 'Dars kontent bloki olindi.',
      data: await this.service.detail(courseId, lessonId, blockId, actor(principal)),
    });
  };

  create = async (request: Request, response: Response): Promise<void> => {
    const principal = authenticatedPrincipal(request);
    const { courseId, lessonId } = lessonBlockParentParamsSchema.parse(request.params);
    const input = createLessonContentBlockSchema.parse(request.body);
    const data = await this.service.create(
      courseId,
      lessonId,
      input,
      actor(principal),
      auditContext(request, principal, courseId),
    );
    response
      .location(`/api/v1/courses/${courseId}/lessons/${lessonId}/blocks/${data.id}`)
      .status(201)
      .json({
        success: true,
        message: 'Dars kontent bloki yaratildi.',
        data,
      });
  };

  update = async (request: Request, response: Response): Promise<void> => {
    const principal = authenticatedPrincipal(request);
    const { courseId, lessonId, blockId } = lessonBlockParamsSchema.parse(request.params);
    const input = updateLessonContentBlockSchema.parse(request.body);
    response.status(200).json({
      success: true,
      message: 'Dars kontent bloki yangilandi.',
      data: await this.service.update(
        courseId,
        lessonId,
        blockId,
        input,
        actor(principal),
        auditContext(request, principal, courseId),
      ),
    });
  };

  reorder = async (request: Request, response: Response): Promise<void> => {
    const principal = authenticatedPrincipal(request);
    const { courseId, lessonId, blockId } = lessonBlockParamsSchema.parse(request.params);
    const { position } = lessonContentBlockPositionSchema.parse(request.body);
    response.status(200).json({
      success: true,
      message: 'Dars kontent bloklari tartibi yangilandi.',
      data: await this.service.reorder(
        courseId,
        lessonId,
        blockId,
        position,
        actor(principal),
        auditContext(request, principal, courseId),
      ),
    });
  };

  updateVisibility = async (request: Request, response: Response): Promise<void> => {
    const principal = authenticatedPrincipal(request);
    const { courseId, lessonId, blockId } = lessonBlockParamsSchema.parse(request.params);
    const { isVisible } = lessonContentBlockVisibilitySchema.parse(request.body);
    response.status(200).json({
      success: true,
      message: 'Dars kontent bloki ko‘rinishi yangilandi.',
      data: await this.service.updateVisibility(
        courseId,
        lessonId,
        blockId,
        isVisible,
        actor(principal),
        auditContext(request, principal, courseId),
      ),
    });
  };

  delete = async (request: Request, response: Response): Promise<void> => {
    const principal = authenticatedPrincipal(request);
    const { courseId, lessonId, blockId } = lessonBlockParamsSchema.parse(request.params);
    deleteLessonContentBlockSchema.parse(request.body);
    await this.service.delete(
      courseId,
      lessonId,
      blockId,
      actor(principal),
      auditContext(request, principal, courseId),
    );
    response.status(200).json({
      success: true,
      message: 'Dars kontent bloki o‘chirildi.',
    });
  };

  restore = async (request: Request, response: Response): Promise<void> => {
    const principal = authenticatedPrincipal(request);
    const { courseId, lessonId, blockId } = lessonBlockParamsSchema.parse(request.params);
    const { position } = restoreLessonContentBlockSchema.parse(request.body);
    response.status(200).json({
      success: true,
      message: 'Dars kontent bloki tiklandi.',
      data: await this.service.restore(
        courseId,
        lessonId,
        blockId,
        position,
        actor(principal),
        auditContext(request, principal, courseId),
      ),
    });
  };

  catalog = async (request: Request, response: Response): Promise<void> => {
    const { courseSlug, lessonSlug } = lessonBlockCatalogParamsSchema.parse(request.params);
    response.status(200).json({
      success: true,
      message: 'Dars kontent bloklari olindi.',
      data: await this.service.catalog(courseSlug, lessonSlug, optionalPrincipal(request)),
    });
  };
}
