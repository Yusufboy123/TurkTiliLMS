import type {
  CertificateArtifactStorageProvider,
  CertificateLifecycleStatus,
  CertificateRevocationReasonCode,
  CertificateTemplateVersionStatus,
  RoleCode,
} from '@prisma/client';
import type { Readable } from 'node:stream';

export interface CertificateActor {
  readonly userId: string;
  readonly sessionId: string;
  readonly roles: RoleCode[];
  readonly permissions: string[];
}

export interface CertificateAuditContext {
  readonly actorUserId: string;
  readonly requestCorrelationId?: string;
  readonly ipHash?: string;
  readonly userAgentSummary?: string;
  readonly reportOperationalAlert?: (alert: CertificateOperationalAlert) => void;
}

export interface PublicCertificateAuditContext {
  readonly requestCorrelationId?: string;
  readonly ipHash: string;
  readonly userAgentSummary?: string;
}

export interface CertificateOperationalAlert {
  readonly event: 'certificate.artifact_integrity_alert' | 'certificate.audit_persistence_failed';
  readonly certificateId?: string;
  readonly artifactId?: string;
  readonly enrollmentId?: string;
  readonly classification: string;
}

export interface IssueCertificateInput {
  readonly eligibilityEvaluationId: string;
  readonly eligibilityEvaluationVersion: number;
  readonly completionVersion: number;
  readonly curriculumVersion: number;
  readonly confirmed: true;
}

export interface IssueCertificateCommand {
  readonly enrollmentId: string;
  readonly input: IssueCertificateInput;
  readonly idempotencyKey: string;
  readonly stepUpProof: string;
}

export interface CertificateMutationReceipt {
  readonly operation: 'ISSUE';
  readonly certificateId: string;
  readonly enrollmentId: string;
  readonly certificateNumber: string;
  readonly resultingStatus: 'ISSUED';
  readonly resultingVersion: 1;
  readonly occurredAt: string;
}

export interface CertificateMutationResponse {
  readonly success: true;
  readonly message: string;
  readonly data: CertificateMutationReceipt;
}

export interface RevokeCertificateInput {
  readonly expectedVersion: number;
  readonly reasonCode: CertificateRevocationReasonCode;
  readonly reasonNote?: string | undefined;
  readonly confirmed: true;
}

export interface RevokeCertificateCommand {
  readonly certificateId: string;
  readonly input: RevokeCertificateInput;
  readonly idempotencyKey: string;
  readonly stepUpProof: string;
}

export interface CertificateRevocationMutationReceipt {
  readonly operation: 'REVOKE';
  readonly certificateId: string;
  readonly enrollmentId: string;
  readonly certificateNumber: string;
  readonly resultingStatus: 'REVOKED';
  readonly resultingVersion: 2;
  readonly occurredAt: string;
}

export interface CertificateRevocationMutationResponse {
  readonly success: true;
  readonly message: string;
  readonly data: CertificateRevocationMutationReceipt;
}

export interface CertificateIssueResult {
  readonly response: CertificateMutationResponse;
  readonly location: string;
}

export interface CertificateTemplateVersionRecord {
  readonly id: string;
  readonly version: number;
  readonly locale: string;
  readonly status: CertificateTemplateVersionStatus;
  readonly rendererContractVersion: string | null;
  readonly organizationDisplayName: string | null;
  readonly signatoryName: string | null;
  readonly signatoryTitle: string | null;
  readonly fontAssetId: string | null;
  readonly fontAssetChecksum: string | null;
  readonly fontFamily: string | null;
  readonly fontVersion: string | null;
  readonly fontLicenseIdentifier: string | null;
  readonly fontLicenseProvenance: string | null;
  readonly templateCode: string;
}

export interface CertificateIssuanceCandidate {
  readonly enrollmentId: string;
  readonly courseId: string;
  readonly studentId: string;
  readonly enrollmentStatus: string;
  readonly completedAt: Date | null;
  readonly courseTitle: string;
  readonly courseSlug: string;
  readonly courseDeletedAt: Date | null;
  readonly recipientDisplayName: string | null;
  readonly studentStatus: string;
  readonly studentDeletedAt: Date | null;
  readonly progressRoot: {
    readonly completionVersion: number;
    readonly curriculumVersion: number;
    readonly frozenAt: Date | null;
    readonly completedEligibleBlocks: number;
    readonly totalEligibleBlocks: number;
    readonly completedLessons: number;
    readonly totalEligibleLessons: number;
    readonly coursePercentage: number;
  } | null;
  readonly eligibility: {
    readonly id: string;
    readonly status: string;
    readonly evaluationVersion: number;
    readonly completedAt: Date;
    readonly completionVersion: number;
    readonly completionCurriculumVersion: number;
    readonly completedLessons: number;
    readonly totalEligibleLessons: number;
    readonly coursePercentage: number;
    readonly policyCode: string;
    readonly policyVersion: number;
    readonly assessmentRule: string;
    readonly requiresAttendance: boolean;
    readonly requiresManualApproval: boolean;
  } | null;
  readonly latestEligibilityEvaluationId: string | null;
  readonly canonicalCompletionEventCount: number;
  readonly templateVersion: CertificateTemplateVersionRecord | null;
  readonly existingCertificateId: string | null;
}

export interface AllocatedCertificateIdentity {
  readonly certificateId: string;
  readonly certificateNumber: string;
  readonly issuedAt: Date;
}

export interface CertificateArtifactPersistenceData {
  readonly storageProvider: CertificateArtifactStorageProvider;
  readonly storageKey: string;
  readonly mimeType: 'application/pdf';
  readonly sizeBytes: bigint;
  readonly checksum: string;
  readonly rendererIdentifier: string;
  readonly rendererVersion: string;
}

export interface CertificateImmutableSnapshot {
  readonly recipientDisplayName: string;
  readonly courseTitle: string;
  readonly organizationName: string;
  readonly locale: 'uz-Latn';
}

export interface CertificateDetailRecord {
  readonly id: string;
  readonly certificateNumber: string;
  readonly enrollmentId: string;
  readonly studentId: string;
  readonly courseId: string;
  readonly courseTitle: string;
  readonly courseSlug: string;
  readonly teacherId: string | null;
  readonly recipientDisplayName: string;
  readonly organizationName: string;
  readonly locale: string;
  readonly status: CertificateLifecycleStatus;
  readonly version: number;
  readonly issuedAt: Date;
  readonly revokedAt: Date | null;
  readonly revocationReasonCode: CertificateRevocationReasonCode | null;
  readonly templateVersion: number;
  readonly artifact: {
    readonly id: string;
    readonly mimeType: string;
    readonly sizeBytes: bigint;
    readonly checksum: string;
  } | null;
}

export interface CertificateRevocationRecord {
  readonly id: string;
  readonly certificateNumber: string;
  readonly enrollmentId: string;
  readonly status: CertificateLifecycleStatus;
  readonly version: number;
}

export interface PublicCertificateRecord {
  readonly certificateNumber: string;
  readonly status: CertificateLifecycleStatus;
  readonly recipientDisplayName: string;
  readonly recipientNameSuppressedAt: Date | null;
  readonly courseTitle: string;
  readonly organizationName: string;
  readonly issuedAt: Date;
  readonly revokedAt: Date | null;
  readonly revocationReasonCode: CertificateRevocationReasonCode | null;
}

export type PublicCertificateStatus = 'VALID' | 'REVOKED';

export interface PublicCertificateDto {
  readonly certificateNumber: string;
  readonly status: PublicCertificateStatus;
  readonly recipientDisplayName: string | null;
  readonly courseTitle: string;
  readonly organizationName: string;
  readonly issuedAt: string;
  readonly revokedAt: string | null;
  readonly safeRevocationReasonCode: CertificateRevocationReasonCode | null;
}

export interface PrivateCertificateDto {
  readonly id: string;
  readonly certificateNumber: string;
  readonly enrollmentId: string;
  readonly course: {
    readonly id: string;
    readonly title: string;
    readonly slug: string;
  };
  readonly recipientDisplayName: string;
  readonly organizationName: string;
  readonly locale: string;
  readonly status: CertificateLifecycleStatus;
  readonly version: number;
  readonly issuedAt: string;
  readonly revokedAt: string | null;
  readonly safeRevocationReasonCode: CertificateRevocationReasonCode | null;
  readonly templateVersion: number;
  readonly artifact: {
    readonly available: boolean;
    readonly mimeType: 'application/pdf';
    readonly sizeBytes: number;
  };
  readonly capabilities: {
    readonly canDownload: boolean;
    readonly canIssue: boolean;
    readonly canRevoke: boolean;
    readonly canReissue: false;
  };
}

export interface CertificateDownload {
  readonly certificateId: string;
  readonly certificateNumber: string;
  readonly mimeType: 'application/pdf';
  readonly contentLength: number;
  readonly checksum: string;
  readonly stream: Readable;
}

export interface StoredIdempotencyReceipt {
  readonly operation: string;
  readonly requestFingerprint: string;
  readonly responseStatus: number;
  readonly responseEnvelope: unknown;
  readonly expiresAt: Date;
}
