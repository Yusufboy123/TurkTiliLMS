import { CertificateLifecycleStatus, RoleCode } from '@prisma/client';
import type {
  CertificateActor,
  CertificateDetailRecord,
  PrivateCertificateDto,
} from './certificate-issuance.types.js';

export function presentPrivateCertificate(
  record: CertificateDetailRecord,
  actor: CertificateActor,
  scope: 'self' | 'course',
): PrivateCertificateDto {
  const isAdmin = actor.roles.includes(RoleCode.ADMIN);
  const canDownload =
    record.artifact !== null &&
    (scope === 'self'
      ? record.status === CertificateLifecycleStatus.ISSUED &&
        actor.permissions.includes('certificates.self_download')
      : isAdmin && actor.permissions.includes('certificates.download'));

  return {
    id: record.id,
    certificateNumber: record.certificateNumber,
    enrollmentId: record.enrollmentId,
    course: {
      id: record.courseId,
      title: record.courseTitle,
      slug: record.courseSlug,
    },
    recipientDisplayName: record.recipientDisplayName,
    organizationName: record.organizationName,
    locale: record.locale,
    status: record.status,
    version: record.version,
    issuedAt: record.issuedAt.toISOString(),
    revokedAt: record.revokedAt?.toISOString() ?? null,
    safeRevocationReasonCode: record.revocationReasonCode,
    templateVersion: record.templateVersion,
    artifact: {
      available: record.artifact !== null,
      mimeType: 'application/pdf',
      sizeBytes: record.artifact ? Number(record.artifact.sizeBytes) : 0,
    },
    capabilities: {
      canDownload,
      canIssue: false,
      canRevoke:
        isAdmin &&
        record.status === CertificateLifecycleStatus.ISSUED &&
        actor.permissions.includes('certificates.revoke'),
      canReissue: false,
    },
  };
}
