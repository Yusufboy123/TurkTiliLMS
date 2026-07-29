import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { ipKeyGenerator } from 'express-rate-limit';
import { pipeline } from 'node:stream/promises';
import { AppError } from '../../utils/app-error.js';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types.js';
import {
  certificateIdParamsSchema,
  courseCertificateParamsSchema,
  idempotencyKeySchema,
  issueCertificateBodySchema,
  issueCertificateParamsSchema,
  revocationIdempotencyKeySchema,
  revokeCertificateBodySchema,
  stepUpProofSchema,
  verificationIdentifierParamsSchema,
} from './certificate-issuance.schemas.js';
import type { CertificateIssuanceUseCases } from './certificate-issuance.service.js';
import type {
  CertificateActor,
  CertificateAuditContext,
  CertificateDownload,
  PublicCertificateAuditContext,
} from './certificate-issuance.types.js';

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

function actorFrom(principal: AuthenticatedPrincipal): CertificateActor {
  return {
    userId: principal.userId,
    sessionId: principal.sessionId,
    roles: principal.roles,
    permissions: principal.permissions,
  };
}

function requestIpHash(request: Request): string {
  return createHash('sha256')
    .update(ipKeyGenerator(request.ip ?? 'unknown'))
    .digest('hex');
}

function auditContext(
  request: Request,
  principal: AuthenticatedPrincipal,
): CertificateAuditContext {
  const requestId = request.header('x-request-id');
  const userAgent = request.header('user-agent')?.slice(0, 512);
  const ipHash = requestIpHash(request);
  const logger = (
    request as Request & {
      log?: { error: (bindings: Record<string, unknown>, message: string) => void };
    }
  ).log;
  return {
    actorUserId: principal.userId,
    ...(requestId && uuidPattern.test(requestId) ? { requestCorrelationId: requestId } : {}),
    ipHash,
    ...(userAgent ? { userAgentSummary: userAgent } : {}),
    ...(logger
      ? {
          reportOperationalAlert: (
            alert: Parameters<NonNullable<CertificateAuditContext['reportOperationalAlert']>>[0],
          ) => {
            logger.error(
              { operationalEvent: alert.event, ...alert },
              'Certificate operational alert',
            );
          },
        }
      : {}),
  };
}

function publicAuditContext(request: Request): PublicCertificateAuditContext {
  const requestId = request.header('x-request-id');
  const userAgent = request.header('user-agent')?.slice(0, 512);
  return {
    ipHash: requestIpHash(request),
    ...(requestId && uuidPattern.test(requestId) ? { requestCorrelationId: requestId } : {}),
    ...(userAgent ? { userAgentSummary: userAgent } : {}),
  };
}

function sendCertificateDownload(response: Response, download: CertificateDownload): Promise<void> {
  response.status(200);
  response.setHeader('Content-Type', download.mimeType);
  response.setHeader(
    'Content-Disposition',
    `attachment; filename="turk-tili-sertifikat-${download.certificateNumber}.pdf"`,
  );
  response.setHeader('Content-Length', String(download.contentLength));
  response.setHeader('ETag', `"sha256-${download.checksum}"`);
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  return pipeline(download.stream, response);
}

export class CertificateIssuanceController {
  constructor(private readonly service: CertificateIssuanceUseCases) {}

  issueCertificate = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { enrollmentId } = issueCertificateParamsSchema.parse(request.params);
    const input = issueCertificateBodySchema.parse(request.body);
    const idempotencyKey = idempotencyKeySchema.parse(request.header('idempotency-key'));
    const stepUpProof = stepUpProofSchema.parse(request.header('x-step-up-proof'));
    const result = await this.service.issueCertificate(
      { enrollmentId, input, idempotencyKey, stepUpProof },
      actorFrom(principal),
      auditContext(request, principal),
    );
    response.location(result.location).status(201).json(result.response);
  };

  verifyPublicCertificate = async (request: Request, response: Response): Promise<void> => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Robots-Tag', 'noindex, nofollow');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const { verificationToken } = verificationIdentifierParamsSchema.parse(request.params);
    const data = await this.service.verifyPublicCertificate(
      verificationToken,
      publicAuditContext(request),
    );
    response.status(200).json({
      success: true,
      message: 'Sertifikat ma\u2018lumotlari tasdiqlandi.',
      data,
    });
  };

  revokeCertificate = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { certificateId } = certificateIdParamsSchema.parse(request.params);
    const input = revokeCertificateBodySchema.parse(request.body);
    const idempotencyKey = revocationIdempotencyKeySchema.parse(request.header('idempotency-key'));
    const stepUpProof = stepUpProofSchema.parse(request.header('x-step-up-proof'));
    const result = await this.service.revokeCertificate(
      { certificateId, input, idempotencyKey, stepUpProof },
      actorFrom(principal),
      auditContext(request, principal),
    );
    response.status(200).json(result);
  };

  getOwnCertificate = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { certificateId } = certificateIdParamsSchema.parse(request.params);
    const data = await this.service.getOwnCertificate(
      certificateId,
      actorFrom(principal),
      auditContext(request, principal),
    );
    response.status(200).json({
      success: true,
      message: 'Sertifikat ma\u2018lumotlari olindi.',
      data,
    });
  };

  getCourseCertificate = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { courseId, certificateId } = courseCertificateParamsSchema.parse(request.params);
    const data = await this.service.getCourseCertificate(
      courseId,
      certificateId,
      actorFrom(principal),
      auditContext(request, principal),
    );
    response.status(200).json({
      success: true,
      message: 'Sertifikat ma\u2018lumotlari olindi.',
      data,
    });
  };

  downloadOwnCertificate = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { certificateId } = certificateIdParamsSchema.parse(request.params);
    const download = await this.service.downloadOwnCertificate(
      certificateId,
      actorFrom(principal),
      auditContext(request, principal),
    );
    await sendCertificateDownload(response, download);
  };

  downloadCourseCertificate = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { courseId, certificateId } = courseCertificateParamsSchema.parse(request.params);
    const download = await this.service.downloadCourseCertificate(
      courseId,
      certificateId,
      actorFrom(principal),
      auditContext(request, principal),
    );
    await sendCertificateDownload(response, download);
  };
}
