import { CertificateLifecycleStatus, RoleCode } from '@prisma/client';

interface CertificateDownloadSubject {
  readonly status: CertificateLifecycleStatus;
  readonly hasArtifact: boolean;
}

interface CertificateDownloadActor {
  readonly roles: RoleCode[];
  readonly permissions: string[];
}

export function canDownloadCertificate(
  subject: CertificateDownloadSubject,
  actor: CertificateDownloadActor,
  scope: 'self' | 'course',
): boolean {
  if (!subject.hasArtifact) return false;

  if (scope === 'self') {
    return (
      subject.status === CertificateLifecycleStatus.ISSUED &&
      actor.roles.includes(RoleCode.STUDENT) &&
      actor.permissions.includes('certificates.self_download')
    );
  }

  return (
    actor.roles.includes(RoleCode.ADMIN) && actor.permissions.includes('certificates.download')
  );
}
