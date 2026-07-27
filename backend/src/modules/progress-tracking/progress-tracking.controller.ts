import type { Request, Response } from 'express';
import { AppError } from '../../utils/app-error.js';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types.js';
import {
  blockProgressParamsSchema,
  completedCoursesQuerySchema,
  completionMutationSchema,
  enrollmentProgressParamsSchema,
  idempotencyKeyHeaderSchema,
  lastVisitedMutationSchema,
  lessonProgressParamsSchema,
  progressSummaryQuerySchema,
} from './progress-tracking.schemas.js';
import type { ProgressTrackingUseCases } from './progress-tracking.service.js';
import type { ProgressActor, ProgressRequestContext } from './progress-tracking.types.js';

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

function actorFrom(principal: AuthenticatedPrincipal): ProgressActor {
  return {
    userId: principal.userId,
    roles: principal.roles,
    permissions: principal.permissions,
  };
}

function mutationContext(request: Request): ProgressRequestContext {
  const idempotencyKey = idempotencyKeyHeaderSchema.parse(request.header('idempotency-key'));
  const requestId = request.header('x-request-id');
  return {
    idempotencyKey,
    ...(requestId && uuidPattern.test(requestId) ? { requestCorrelationId: requestId } : {}),
  };
}

export class ProgressTrackingController {
  constructor(private readonly progress: ProgressTrackingUseCases) {}

  getOwnSummary = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { activeLimit } = progressSummaryQuerySchema.parse(request.query);
    const data = await this.progress.getOwnSummary(activeLimit, actorFrom(principal));
    response.status(200).json({
      success: true,
      message: 'O‘qish jarayoni olindi.',
      data,
    });
  };

  listOwnCompleted = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const query = completedCoursesQuerySchema.parse(request.query);
    const data = await this.progress.listOwnCompleted(query, actorFrom(principal));
    response.status(200).json({
      success: true,
      message: 'Yakunlangan kurslar olindi.',
      data,
    });
  };

  getOwnEnrollmentProgress = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { enrollmentId } = enrollmentProgressParamsSchema.parse(request.params);
    const data = await this.progress.getOwnEnrollmentProgress(enrollmentId, actorFrom(principal));
    response.status(200).json({
      success: true,
      message: 'Kurs jarayoni olindi.',
      data,
    });
  };

  getOwnResumeTarget = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { enrollmentId } = enrollmentProgressParamsSchema.parse(request.params);
    const data = await this.progress.getOwnResumeTarget(enrollmentId, actorFrom(principal));
    response.status(200).json({
      success: true,
      message: data
        ? 'Davom ettirish uchun dars olindi.'
        : 'Davom ettirish uchun dars mavjud emas.',
      data,
    });
  };

  completeBlock = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { enrollmentId, blockId } = blockProgressParamsSchema.parse(request.params);
    const input = completionMutationSchema.parse(request.body);
    const result = await this.progress.completeBlock(
      enrollmentId,
      blockId,
      input,
      actorFrom(principal),
      mutationContext(request),
    );
    this.sendMutation(response, result);
  };

  reopenBlock = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { enrollmentId, blockId } = blockProgressParamsSchema.parse(request.params);
    const input = completionMutationSchema.parse(request.body);
    const result = await this.progress.reopenBlock(
      enrollmentId,
      blockId,
      input,
      actorFrom(principal),
      mutationContext(request),
    );
    this.sendMutation(response, result);
  };

  completeLesson = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { enrollmentId, lessonId } = lessonProgressParamsSchema.parse(request.params);
    const input = completionMutationSchema.parse(request.body);
    const result = await this.progress.completeLesson(
      enrollmentId,
      lessonId,
      input,
      actorFrom(principal),
      mutationContext(request),
    );
    this.sendMutation(response, result);
  };

  reopenLesson = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { enrollmentId, lessonId } = lessonProgressParamsSchema.parse(request.params);
    const input = completionMutationSchema.parse(request.body);
    const result = await this.progress.reopenLesson(
      enrollmentId,
      lessonId,
      input,
      actorFrom(principal),
      mutationContext(request),
    );
    this.sendMutation(response, result);
  };

  recordLastVisitedLesson = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { enrollmentId } = enrollmentProgressParamsSchema.parse(request.params);
    const input = lastVisitedMutationSchema.parse(request.body);
    const result = await this.progress.recordLastVisitedLesson(
      enrollmentId,
      input,
      actorFrom(principal),
      mutationContext(request),
    );
    this.sendMutation(response, result);
  };

  private sendMutation(response: Response, result: { envelope: unknown; replayed: boolean }): void {
    response.setHeader('Idempotency-Replayed', String(result.replayed));
    response.status(200).json(result.envelope);
  }
}
