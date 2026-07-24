import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import type { Logger } from 'pino';
import { AppError } from '../../utils/app-error.js';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types.js';
import { deleteMediaSchema, mediaIdParamsSchema } from './media.schemas.js';
import type { MediaManagementUseCases } from './media.service.js';
import type { MediaActor, MediaAuditContext, StagedMediaUpload } from './media.types.js';

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

function actorFrom(principal: AuthenticatedPrincipal): MediaActor {
  return {
    userId: principal.userId,
    roles: principal.roles,
    permissions: principal.permissions,
  };
}

function auditContext(request: Request, principal: AuthenticatedPrincipal): MediaAuditContext {
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

function stagedUploadFrom(request: Request): StagedMediaUpload {
  if (!request.file) {
    throw new AppError('Yuklash uchun “file” maydonida fayl yuboring.', 422, 'MEDIA_FILE_REQUIRED');
  }
  return {
    path: request.file.path,
    originalFileName: request.file.originalname,
    declaredMimeType: request.file.mimetype,
    sizeBytes: request.file.size,
  };
}

function contentDisposition(fileName: string): string {
  const fallback = fileName
    .replace(/[^\x20-\x7e]/gu, '_')
    .replaceAll('"', '_')
    .slice(0, 150);
  return `attachment; filename="${fallback || 'download'}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export class MediaController {
  constructor(private readonly media: MediaManagementUseCases) {}

  upload = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const file = await this.media.upload(
      stagedUploadFrom(request),
      actorFrom(principal),
      auditContext(request, principal),
    );
    response.location(`/api/v1/media/${file.id}`).status(201).json({
      success: true,
      message: 'Media fayl muvaffaqiyatli yuklandi.',
      data: file,
    });
  };

  getById = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { id } = mediaIdParamsSchema.parse(request.params);
    const file = await this.media.getById(id, actorFrom(principal));
    response.status(200).json({
      success: true,
      message: 'Media fayl ma’lumotlari olindi.',
      data: file,
    });
  };

  usages = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { id } = mediaIdParamsSchema.parse(request.params);
    response.status(200).json({
      success: true,
      message: 'Media fayl ishlatilayotgan joylar olindi.',
      data: await this.media.usages(id, actorFrom(principal)),
    });
  };

  download = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { id } = mediaIdParamsSchema.parse(request.params);
    const download = await this.media.download(id, actorFrom(principal));
    response.setHeader('Content-Type', download.mimeType);
    response.setHeader('Content-Length', download.contentLength.toString());
    response.setHeader('Content-Disposition', contentDisposition(download.originalFileName));
    response.setHeader('Cache-Control', 'private, no-store');
    download.stream.on('error', (error: Error) => {
      const logger = (request as Request & { log?: Logger }).log;
      logger?.error({ err: error, mediaId: id }, 'Media download stream failed');
      response.destroy(error);
    });
    download.stream.pipe(response);
  };

  delete = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { id } = mediaIdParamsSchema.parse(request.params);
    deleteMediaSchema.parse(request.body);
    await this.media.delete(id, actorFrom(principal), auditContext(request, principal));
    response.status(200).json({
      success: true,
      message: 'Media fayl o‘chirildi. Uni keyinroq tiklash mumkin.',
    });
  };

  restore = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { id } = mediaIdParamsSchema.parse(request.params);
    const file = await this.media.restore(
      id,
      actorFrom(principal),
      auditContext(request, principal),
    );
    response.status(200).json({
      success: true,
      message: 'Media fayl tiklandi.',
      data: file,
    });
  };
}
