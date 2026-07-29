import {
  CertificateEligibilityAssessmentRule,
  CertificateEligibilityPolicyCode,
  CertificateEligibilityStatus,
  CertificateLifecycleStatus,
  CertificateTemplateVersionStatus,
  CourseEnrollmentStatus,
  IdempotencyOperation,
  RoleCode,
  StepUpAction,
  StepUpTargetType,
} from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { AppError } from '../../utils/app-error.js';
import {
  CERTIFICATE_RENDERER_CONTRACT_VERSION,
  CERTIFICATE_TEMPLATE_CODE,
  CERTIFICATE_TEMPLATE_VERSION,
} from '../certificate-artifacts/certificate-artifact.constants.js';
import type { CertificateArtifactUseCases } from '../certificate-artifacts/certificate-artifact.service.js';
import { CertificateArtifactError } from '../certificate-artifacts/certificate-artifact.errors.js';
import type {
  CertificateRenderInput,
  CertificateRenderSourceRecord,
  PreparedCertificateArtifact,
} from '../certificate-artifacts/certificate-artifact.types.js';
import { normalizeCertificateRenderInput } from '../certificate-artifacts/certificate-render-input.js';
import type { StepUpAuthenticationUseCases } from '../step-up-authentication/step-up-authentication.service.js';
import type { StepUpSecurityContext } from '../step-up-authentication/step-up-authentication.types.js';
import {
  presentPrivateCertificate,
  presentPublicCertificate,
} from './certificate-issuance.presenter.js';
import {
  certificateAccessDenied,
  certificateAlreadyIssued,
  certificateAlreadyRevoked,
  certificateArtifactGenerationFailed,
  certificateArtifactStorageFailed,
  certificateArtifactUnavailable,
  certificateCourseScopeDenied,
  certificateEnrollmentNotFound,
  certificateEvidenceConflict,
  certificateIssuanceConflict,
  CertificateIssuanceRepositoryConflictError,
  certificateNotEligible,
  certificateNotFound,
  certificateNumberingConflict,
  certificateRateLimited,
  certificateRevoked,
  certificateTemplateUnavailable,
  CertificateRateLimitRepositoryError,
  certificateVerificationNotFound,
  certificateVersionConflict,
  idempotencyKeyReused,
} from './certificate-issuance.errors.js';
import type { CertificateIssuanceRepository } from './certificate-issuance.repository.js';
import {
  revokeCertificateBodySchema,
  verificationIdentifierSchema,
} from './certificate-issuance.schemas.js';
import type {
  CertificateActor,
  CertificateAuditContext,
  CertificateDownload,
  CertificateDetailRecord,
  CertificateIssueResult,
  CertificateIssuanceCandidate,
  CertificateImmutableSnapshot,
  CertificateMutationResponse,
  CertificateRevocationMutationResponse,
  IssueCertificateCommand,
  PrivateCertificateDto,
  PublicCertificateAuditContext,
  PublicCertificateDto,
  RevokeCertificateCommand,
  StoredIdempotencyReceipt,
} from './certificate-issuance.types.js';

const CONTRACT_VERSION = 'certificate-issuance-v1';
const REVOCATION_CONTRACT_VERSION = 'certificate-revocation-v1';
const INVALID_VERIFICATION_LOOKUP_VALUE = 'invalid-certificate-verification-identifier';

function assertIssuePolicy(actor: CertificateActor): void {
  if (!actor.roles.includes(RoleCode.ADMIN) || !actor.permissions.includes('certificates.issue')) {
    throw certificateAccessDenied();
  }
}

function assertSelfPolicy(actor: CertificateActor, permission: string): void {
  if (!actor.roles.includes(RoleCode.STUDENT) || !actor.permissions.includes(permission)) {
    throw certificateAccessDenied();
  }
}

function assertCourseReadPolicy(actor: CertificateActor): void {
  if (
    (!actor.roles.includes(RoleCode.ADMIN) && !actor.roles.includes(RoleCode.TEACHER)) ||
    !actor.permissions.includes('certificates.course_read')
  ) {
    throw certificateAccessDenied();
  }
}

function assertCourseDownloadPolicy(actor: CertificateActor): void {
  if (
    !actor.roles.includes(RoleCode.ADMIN) ||
    !actor.permissions.includes('certificates.download')
  ) {
    throw certificateAccessDenied();
  }
}

function assertRevokePolicy(actor: CertificateActor): void {
  if (!actor.roles.includes(RoleCode.ADMIN) || !actor.permissions.includes('certificates.revoke')) {
    throw certificateAccessDenied();
  }
}

function assertCurrentRevokePolicy(
  security: StepUpSecurityContext | null,
  actor: CertificateActor,
  now: Date,
): asserts security is StepUpSecurityContext {
  if (
    !security ||
    security.userId !== actor.userId ||
    security.sessionId !== actor.sessionId ||
    security.requiresPasswordChange ||
    (security.credentialLockedUntil !== null && security.credentialLockedUntil > now) ||
    !security.roles.includes(RoleCode.ADMIN) ||
    !security.permissions.includes('certificates.revoke')
  ) {
    throw certificateAccessDenied();
  }
}

function sameInstant(left: Date | null, right: Date | null): boolean {
  return left !== null && right !== null && left.getTime() === right.getTime();
}

function assertCandidate(
  candidate: CertificateIssuanceCandidate | null,
  command: IssueCertificateCommand,
): asserts candidate is CertificateIssuanceCandidate & {
  completedAt: Date;
  recipientDisplayName: string;
  progressRoot: NonNullable<CertificateIssuanceCandidate['progressRoot']>;
  eligibility: NonNullable<CertificateIssuanceCandidate['eligibility']>;
  templateVersion: NonNullable<CertificateIssuanceCandidate['templateVersion']>;
} {
  if (!candidate) throw certificateEnrollmentNotFound();
  if (candidate.existingCertificateId) throw certificateAlreadyIssued();
  if (
    candidate.enrollmentStatus !== CourseEnrollmentStatus.COMPLETED ||
    !candidate.completedAt ||
    !candidate.progressRoot?.frozenAt
  ) {
    throw certificateNotEligible();
  }
  if (!candidate.recipientDisplayName || candidate.courseDeletedAt) {
    throw certificateEvidenceConflict();
  }
  const evidence = candidate.eligibility;
  if (!evidence || evidence.status !== CertificateEligibilityStatus.ELIGIBLE) {
    throw certificateNotEligible();
  }
  if (
    candidate.latestEligibilityEvaluationId !== evidence.id ||
    evidence.id !== command.input.eligibilityEvaluationId ||
    evidence.evaluationVersion !== command.input.eligibilityEvaluationVersion ||
    evidence.completionVersion !== command.input.completionVersion ||
    evidence.completionCurriculumVersion !== command.input.curriculumVersion ||
    candidate.progressRoot.completionVersion !== command.input.completionVersion ||
    candidate.progressRoot.curriculumVersion !== command.input.curriculumVersion ||
    !sameInstant(candidate.completedAt, candidate.progressRoot.frozenAt) ||
    !sameInstant(candidate.completedAt, evidence.completedAt) ||
    candidate.canonicalCompletionEventCount !== 1 ||
    evidence.completedLessons !== candidate.progressRoot.completedLessons ||
    evidence.totalEligibleLessons !== candidate.progressRoot.totalEligibleLessons ||
    evidence.coursePercentage !== candidate.progressRoot.coursePercentage ||
    evidence.policyCode !== CertificateEligibilityPolicyCode.COURSE_COMPLETION_ONLY ||
    evidence.policyVersion !== 1 ||
    evidence.assessmentRule !== CertificateEligibilityAssessmentRule.NONE ||
    evidence.requiresAttendance ||
    evidence.requiresManualApproval
  ) {
    throw certificateEvidenceConflict();
  }
  const template = candidate.templateVersion;
  if (
    !template ||
    template.status !== CertificateTemplateVersionStatus.ACTIVE ||
    template.templateCode !== CERTIFICATE_TEMPLATE_CODE ||
    template.version !== CERTIFICATE_TEMPLATE_VERSION ||
    template.locale !== 'uz-Latn' ||
    template.rendererContractVersion !== CERTIFICATE_RENDERER_CONTRACT_VERSION ||
    !template.organizationDisplayName ||
    !template.fontAssetId ||
    !template.fontAssetChecksum ||
    !template.fontFamily ||
    !template.fontVersion ||
    !template.fontLicenseIdentifier ||
    !template.fontLicenseProvenance
  ) {
    throw certificateTemplateUnavailable();
  }
}

function fingerprint(command: IssueCertificateCommand): string {
  const canonical = JSON.stringify({
    contractVersion: CONTRACT_VERSION,
    operation: 'ISSUE_CERTIFICATE',
    path: { enrollmentId: command.enrollmentId },
    body: {
      eligibilityEvaluationId: command.input.eligibilityEvaluationId,
      eligibilityEvaluationVersion: command.input.eligibilityEvaluationVersion,
      completionVersion: command.input.completionVersion,
      curriculumVersion: command.input.curriculumVersion,
      confirmed: command.input.confirmed,
    },
  });
  return createHash('sha256').update(canonical).digest('hex');
}

function replay(
  record: StoredIdempotencyReceipt | null,
  requestFingerprint: string,
): CertificateMutationResponse | null {
  if (!record) return null;
  if (
    record.operation !== IdempotencyOperation.ISSUE_CERTIFICATE ||
    record.requestFingerprint !== requestFingerprint
  ) {
    throw idempotencyKeyReused();
  }
  if (record.responseStatus !== 201) throw idempotencyKeyReused();
  return record.responseEnvelope as unknown as CertificateMutationResponse;
}

function revocationFingerprint(command: RevokeCertificateCommand): string {
  const canonical = JSON.stringify({
    contractVersion: REVOCATION_CONTRACT_VERSION,
    operation: 'REVOKE_CERTIFICATE',
    path: { certificateId: command.certificateId },
    body: {
      expectedVersion: command.input.expectedVersion,
      reasonCode: command.input.reasonCode,
      reasonNote: command.input.reasonNote ?? null,
      confirmed: command.input.confirmed,
    },
  });
  return createHash('sha256').update(canonical).digest('hex');
}

function replayRevocation(
  record: StoredIdempotencyReceipt | null,
  requestFingerprint: string,
): CertificateRevocationMutationResponse | null {
  if (!record) return null;
  if (
    record.operation !== IdempotencyOperation.REVOKE_CERTIFICATE ||
    record.requestFingerprint !== requestFingerprint ||
    record.responseStatus !== 200
  ) {
    throw idempotencyKeyReused();
  }
  return record.responseEnvelope as unknown as CertificateRevocationMutationResponse;
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toRenderSource(
  candidate: CertificateIssuanceCandidate & {
    completedAt: Date;
    recipientDisplayName: string;
    eligibility: NonNullable<CertificateIssuanceCandidate['eligibility']>;
    templateVersion: NonNullable<CertificateIssuanceCandidate['templateVersion']>;
  },
  certificateId: string,
  certificateNumber: string,
  issuedAt: Date,
  verificationIdentifier: string | null,
): CertificateRenderSourceRecord {
  return {
    id: certificateId,
    certificateNumber,
    recipientDisplayName: candidate.recipientDisplayName,
    courseTitle: candidate.courseTitle,
    organizationName: candidate.templateVersion.organizationDisplayName!,
    locale: candidate.templateVersion.locale,
    issueDate: new Date(`${dateOnly(issuedAt)}T00:00:00.000Z`),
    issuedAt,
    completionDate: candidate.completedAt,
    artifactId: null,
    verificationIdentifier,
    templateVersion: candidate.templateVersion,
  };
}

function toRenderInput(source: CertificateRenderSourceRecord): CertificateRenderInput {
  return {
    certificateId: source.id,
    certificateNumber: source.certificateNumber,
    recipientDisplayName: source.recipientDisplayName,
    courseTitle: source.courseTitle,
    completionDate: dateOnly(source.completionDate),
    issueDate: dateOnly(source.issueDate),
    issuedAt: source.issuedAt.toISOString(),
    organizationName: source.organizationName,
    locale: 'uz-Latn',
    templateCode: CERTIFICATE_TEMPLATE_CODE,
    templateVersionId: source.templateVersion.id,
    templateVersion: CERTIFICATE_TEMPLATE_VERSION,
    rendererContractVersion: CERTIFICATE_RENDERER_CONTRACT_VERSION,
    signatoryName: source.templateVersion.signatoryName,
    signatoryTitle: source.templateVersion.signatoryTitle,
    verificationIdentifier: source.verificationIdentifier ?? null,
  };
}

type ValidatedCandidate = CertificateIssuanceCandidate & {
  completedAt: Date;
  recipientDisplayName: string;
  progressRoot: NonNullable<CertificateIssuanceCandidate['progressRoot']>;
  eligibility: NonNullable<CertificateIssuanceCandidate['eligibility']>;
  templateVersion: NonNullable<CertificateIssuanceCandidate['templateVersion']>;
};

function canonicalIssuanceSnapshot(
  candidate: ValidatedCandidate,
  identity: { certificateId: string; certificateNumber: string; issuedAt: Date },
  verificationTokenHash: string,
  renderer: { readonly identifier: string; readonly version: string },
): { fingerprint: string; snapshot: CertificateImmutableSnapshot } {
  const source = toRenderSource(
    candidate,
    identity.certificateId,
    identity.certificateNumber,
    identity.issuedAt,
    'A'.repeat(43),
  );
  const normalized = normalizeCertificateRenderInput(toRenderInput(source));
  const snapshot: CertificateImmutableSnapshot = {
    recipientDisplayName: normalized.recipientDisplayName,
    courseTitle: normalized.courseTitle,
    organizationName: normalized.organizationName,
    locale: normalized.locale,
  };
  const canonical = JSON.stringify({
    render: {
      certificateId: normalized.certificateId,
      certificateNumber: normalized.certificateNumber,
      recipientDisplayName: normalized.recipientDisplayName,
      courseTitle: normalized.courseTitle,
      completionDate: normalized.completionDate,
      issueDate: normalized.issueDate,
      issuedAt: normalized.issuedAt,
      organizationName: normalized.organizationName,
      locale: normalized.locale,
      templateCode: normalized.templateCode,
      templateVersionId: normalized.templateVersionId,
      templateVersion: normalized.templateVersion,
      rendererContractVersion: normalized.rendererContractVersion,
      rendererIdentifier: renderer.identifier,
      rendererVersion: renderer.version,
      signatoryName: normalized.signatoryName,
      signatoryTitle: normalized.signatoryTitle,
      verificationIdentifierHash: verificationTokenHash,
    },
    evidence: {
      enrollmentId: candidate.enrollmentId,
      courseId: candidate.courseId,
      studentId: candidate.studentId,
      eligibilityEvaluationId: candidate.eligibility.id,
      evaluationVersion: candidate.eligibility.evaluationVersion,
      completionVersion: candidate.eligibility.completionVersion,
      curriculumVersion: candidate.eligibility.completionCurriculumVersion,
      policyCode: candidate.eligibility.policyCode,
      policyVersion: candidate.eligibility.policyVersion,
      assessmentRule: candidate.eligibility.assessmentRule,
      requiresAttendance: candidate.eligibility.requiresAttendance,
      requiresManualApproval: candidate.eligibility.requiresManualApproval,
      completedEligibleBlocks: candidate.progressRoot.completedEligibleBlocks,
      totalEligibleBlocks: candidate.progressRoot.totalEligibleBlocks,
      completedLessons: candidate.eligibility.completedLessons,
      totalEligibleLessons: candidate.eligibility.totalEligibleLessons,
      coursePercentage: candidate.eligibility.coursePercentage,
      templateStatus: candidate.templateVersion.status,
      fontAssetId: candidate.templateVersion.fontAssetId,
      fontAssetChecksum: candidate.templateVersion.fontAssetChecksum,
      fontFamily: candidate.templateVersion.fontFamily,
      fontVersion: candidate.templateVersion.fontVersion,
      fontLicenseIdentifier: candidate.templateVersion.fontLicenseIdentifier,
      fontLicenseProvenance: candidate.templateVersion.fontLicenseProvenance,
    },
  });
  return {
    fingerprint: createHash('sha256').update(canonical).digest('hex'),
    snapshot,
  };
}

function reportOperationalAlert(
  audit: CertificateAuditContext,
  alert: Parameters<NonNullable<CertificateAuditContext['reportOperationalAlert']>>[0],
): void {
  audit.reportOperationalAlert?.(alert);
}

function mapArtifactFailure(error: CertificateArtifactError): AppError {
  if (
    [
      'INVALID_RENDER_INPUT',
      'UNSUPPORTED_LOCALE',
      'UNSUPPORTED_TEMPLATE',
      'FONT_ASSET_UNAVAILABLE',
      'FONT_ASSET_MISMATCH',
      'RENDER_TIMEOUT',
      'RENDER_FAILED',
      'INVALID_PDF_OUTPUT',
      'ARTIFACT_TOO_LARGE',
    ].includes(error.category)
  ) {
    return certificateArtifactGenerationFailed();
  }
  return certificateArtifactStorageFailed();
}

function failureReason(error: unknown): string {
  return error instanceof AppError ? error.code : 'INTERNAL_ERROR';
}

export interface CertificateIssuanceUseCases {
  issueCertificate(
    command: IssueCertificateCommand,
    actor: CertificateActor,
    audit: CertificateAuditContext,
  ): Promise<CertificateIssueResult>;
  getOwnCertificate(
    certificateId: string,
    actor: CertificateActor,
    audit: CertificateAuditContext,
  ): Promise<PrivateCertificateDto>;
  getCourseCertificate(
    courseId: string,
    certificateId: string,
    actor: CertificateActor,
    audit: CertificateAuditContext,
  ): Promise<PrivateCertificateDto>;
  downloadOwnCertificate(
    certificateId: string,
    actor: CertificateActor,
    audit: CertificateAuditContext,
  ): Promise<CertificateDownload>;
  downloadCourseCertificate(
    courseId: string,
    certificateId: string,
    actor: CertificateActor,
    audit: CertificateAuditContext,
  ): Promise<CertificateDownload>;
  verifyPublicCertificate(
    verificationIdentifier: string,
    audit: PublicCertificateAuditContext,
  ): Promise<PublicCertificateDto>;
  revokeCertificate(
    command: RevokeCertificateCommand,
    actor: CertificateActor,
    audit: CertificateAuditContext,
  ): Promise<CertificateRevocationMutationResponse>;
}

export class CertificateIssuanceService implements CertificateIssuanceUseCases {
  constructor(
    private readonly repository: CertificateIssuanceRepository,
    private readonly artifacts: CertificateArtifactUseCases,
    private readonly stepUp: StepUpAuthenticationUseCases,
  ) {}

  async issueCertificate(
    command: IssueCertificateCommand,
    actor: CertificateActor,
    audit: CertificateAuditContext,
  ): Promise<CertificateIssueResult> {
    assertIssuePolicy(actor);
    const requestFingerprint = fingerprint(command);
    const existingReplay = replay(
      await this.repository.findIdempotencyRecord(actor.userId, command.idempotencyKey),
      requestFingerprint,
    );
    if (existingReplay) {
      const certificate = await this.repository.findCertificate(existingReplay.data.certificateId);
      if (!certificate) throw certificateIssuanceConflict();
      return {
        response: existingReplay,
        location: `/api/v1/courses/${certificate.courseId}/certificates/${certificate.id}`,
      };
    }

    let prepared: PreparedCertificateArtifact | undefined;
    let verificationCapability: string | undefined;
    let phase = 'preflight';
    let transactionAttempt = 1;
    try {
      await this.stepUp.validateProof(
        {
          proof: command.stepUpProof,
          action: StepUpAction.CERTIFICATE_ISSUE,
          targetType: StepUpTargetType.ENROLLMENT,
          targetId: command.enrollmentId,
        },
        actor,
      );
      const candidate = await this.repository.findCandidate(
        command.enrollmentId,
        command.input.eligibilityEvaluationId,
      );
      assertCandidate(candidate, command);
      await this.repository.recordIssueRequested(
        command.enrollmentId,
        command.input.eligibilityEvaluationId,
        requestFingerprint.slice(0, 12),
        candidate.templateVersion.version,
        audit,
      );

      phase = 'numbering';
      const identity = await this.repository.allocateIdentity();
      verificationCapability = randomBytes(32).toString('base64url');
      const verificationTokenHash = createHash('sha256')
        .update(verificationCapability)
        .digest('hex');
      phase = 'artifact';
      {
        const renderSource = toRenderSource(
          candidate,
          identity.certificateId,
          identity.certificateNumber,
          identity.issuedAt,
          verificationCapability,
        );
        const renderInput = normalizeCertificateRenderInput(toRenderInput(renderSource));
        prepared = await this.artifacts.prepareCertificateArtifact({
          certificateId: identity.certificateId,
          renderInput,
          renderSource,
        });
      }
      const initialSnapshot = canonicalIssuanceSnapshot(
        candidate,
        identity,
        verificationTokenHash,
        {
          identifier: prepared.rendererIdentifier,
          version: prepared.rendererVersion,
        },
      );
      verificationCapability = undefined;
      const responseEnvelope: CertificateMutationResponse = {
        success: true,
        message: 'Sertifikat muvaffaqiyatli berildi.',
        data: {
          operation: 'ISSUE',
          certificateId: identity.certificateId,
          enrollmentId: command.enrollmentId,
          certificateNumber: identity.certificateNumber,
          resultingStatus: 'ISSUED',
          resultingVersion: 1,
          occurredAt: identity.issuedAt.toISOString(),
        },
      };

      phase = 'commit';
      let result: CertificateMutationResponse;
      try {
        result = await this.repository.withSerializableTransaction(async (transaction, attempt) => {
          transactionAttempt = attempt;
          const concurrentReplay = replay(
            await transaction.findIdempotencyRecord(actor.userId, command.idempotencyKey),
            requestFingerprint,
          );
          if (concurrentReplay) return concurrentReplay;
          const validatedProof = await this.stepUp.validateProofBeforeTargetLockInTransaction(
            transaction.stepUp,
            {
              proof: command.stepUpProof,
              action: StepUpAction.CERTIFICATE_ISSUE,
              targetType: StepUpTargetType.ENROLLMENT,
              targetId: command.enrollmentId,
            },
            actor,
          );
          await transaction.lockEvidence(
            command.enrollmentId,
            command.input.eligibilityEvaluationId,
            candidate.templateVersion.id,
          );
          const lockedCandidate = await transaction.findCandidate(
            command.enrollmentId,
            command.input.eligibilityEvaluationId,
          );
          assertCandidate(lockedCandidate, command);
          const finalSnapshot = canonicalIssuanceSnapshot(
            lockedCandidate,
            identity,
            verificationTokenHash,
            {
              identifier: prepared!.rendererIdentifier,
              version: prepared!.rendererVersion,
            },
          );
          if (finalSnapshot.fingerprint !== initialSnapshot.fingerprint) {
            throw certificateEvidenceConflict();
          }
          await this.stepUp.consumeValidatedProof(transaction.stepUp, validatedProof, audit);
          await transaction.createIssuedCertificate({
            identity,
            candidate: lockedCandidate,
            snapshot: finalSnapshot.snapshot,
            verificationTokenHash,
            artifact: {
              storageProvider: prepared!.storageProvider,
              storageKey: prepared!.storageKey,
              mimeType: prepared!.mimeType,
              sizeBytes: BigInt(prepared!.sizeBytes),
              checksum: prepared!.checksum,
              rendererIdentifier: prepared!.rendererIdentifier,
              rendererVersion: prepared!.rendererVersion,
            },
            actorUserId: actor.userId,
            idempotencyKey: command.idempotencyKey,
            requestFingerprint,
            responseEnvelope,
            audit,
          });
          return responseEnvelope;
        });
      } catch (transactionError: unknown) {
        if (!(transactionError instanceof CertificateIssuanceRepositoryConflictError)) {
          throw transactionError;
        }
        transactionAttempt = transactionError.attempt;
        const committedReplay = replay(
          await this.repository.findIdempotencyRecord(actor.userId, command.idempotencyKey),
          requestFingerprint,
        );
        if (!committedReplay) throw transactionError;
        result = committedReplay;
      }
      if (result !== responseEnvelope) {
        await this.artifacts.discardPreparedCertificateArtifact(prepared);
      }
      prepared = undefined;
      return {
        response: result,
        location: `/api/v1/courses/${candidate.courseId}/certificates/${result.data.certificateId}`,
      };
    } catch (caught: unknown) {
      verificationCapability = undefined;
      let error: unknown = caught;
      if (prepared) {
        try {
          await this.artifacts.discardPreparedCertificateArtifact(prepared);
        } catch {
          error = certificateArtifactStorageFailed();
        }
      }
      if (error instanceof CertificateArtifactError) error = mapArtifactFailure(error);
      if (error instanceof CertificateIssuanceRepositoryConflictError) {
        if (error.kind === 'already-issued') error = certificateAlreadyIssued();
        else if (error.kind === 'numbering') error = certificateNumberingConflict();
        else if (error.kind === 'idempotency') error = idempotencyKeyReused();
        else error = certificateIssuanceConflict();
      }
      if (error instanceof CertificateRateLimitRepositoryError) error = certificateRateLimited();
      try {
        await this.repository.recordIssueFailed(
          command.enrollmentId,
          phase,
          failureReason(error),
          transactionAttempt,
          audit,
        );
      } catch {
        reportOperationalAlert(audit, {
          event: 'certificate.audit_persistence_failed',
          enrollmentId: command.enrollmentId,
          classification: 'ISSUE_FAILED_AUDIT_PERSISTENCE',
        });
      }
      throw error;
    }
  }

  async verifyPublicCertificate(
    verificationIdentifier: string,
    audit: PublicCertificateAuditContext,
  ): Promise<PublicCertificateDto> {
    const parsed = verificationIdentifierSchema.safeParse(verificationIdentifier);
    const lookupHash = createHash('sha256')
      .update(parsed.success ? parsed.data : INVALID_VERIFICATION_LOOKUP_VALUE)
      .digest('hex');

    let record;
    try {
      record = await this.repository.verifyPublicCertificate(lookupHash, !parsed.success, audit);
    } catch (error: unknown) {
      if (error instanceof CertificateRateLimitRepositoryError) {
        throw certificateRateLimited();
      }
      // Public verification telemetry is deliberately best-effort. A telemetry
      // write failure must not change a valid credential result.
      record = parsed.success
        ? await this.repository.findPublicCertificateByHash(lookupHash)
        : null;
    }

    if (!record) throw certificateVerificationNotFound();
    return presentPublicCertificate(record);
  }

  async revokeCertificate(
    command: RevokeCertificateCommand,
    actor: CertificateActor,
    audit: CertificateAuditContext,
  ): Promise<CertificateRevocationMutationResponse> {
    assertRevokePolicy(actor);
    const input = revokeCertificateBodySchema.parse(command.input);
    const normalizedCommand: RevokeCertificateCommand = { ...command, input };
    const requestFingerprint = revocationFingerprint(normalizedCommand);

    try {
      return await this.repository.withSerializableTransaction(async (transaction) => {
        const securityTime = await transaction.stepUp.getDatabaseTimestamp();
        await transaction.stepUp.lockSecurityState(actor.userId, actor.sessionId);
        const security = await transaction.stepUp.findSecurityContext(
          actor.userId,
          actor.sessionId,
          securityTime,
        );
        assertCurrentRevokePolicy(security, actor, securityTime);

        const existingReplay = replayRevocation(
          await transaction.findIdempotencyRecord(actor.userId, normalizedCommand.idempotencyKey),
          requestFingerprint,
        );
        if (existingReplay) return existingReplay;

        const validatedProof = await this.stepUp.validateProofBeforeTargetLockInTransaction(
          transaction.stepUp,
          {
            proof: normalizedCommand.stepUpProof,
            action: StepUpAction.CERTIFICATE_REVOKE,
            targetType: StepUpTargetType.CERTIFICATE,
            targetId: normalizedCommand.certificateId,
          },
          actor,
        );
        await transaction.lockCertificate(normalizedCommand.certificateId);
        await transaction.lockIdempotencyKey(actor.userId, normalizedCommand.idempotencyKey);

        const concurrentReplay = replayRevocation(
          await transaction.findIdempotencyRecord(actor.userId, normalizedCommand.idempotencyKey),
          requestFingerprint,
        );
        if (concurrentReplay) return concurrentReplay;

        const certificate = await transaction.findCertificateForRevocation(
          normalizedCommand.certificateId,
        );
        if (!certificate) throw certificateNotFound();
        if (certificate.status === CertificateLifecycleStatus.REVOKED) {
          throw certificateAlreadyRevoked();
        }
        if (
          certificate.version !== normalizedCommand.input.expectedVersion ||
          certificate.version !== 1
        ) {
          throw certificateVersionConflict();
        }

        const response: CertificateRevocationMutationResponse = {
          success: true,
          message: 'Sertifikat muvaffaqiyatli bekor qilindi.',
          data: {
            operation: 'REVOKE',
            certificateId: certificate.id,
            enrollmentId: certificate.enrollmentId,
            certificateNumber: certificate.certificateNumber,
            resultingStatus: 'REVOKED',
            resultingVersion: 2,
            occurredAt: validatedProof.now.toISOString(),
          },
        };

        await this.stepUp.consumeValidatedProof(transaction.stepUp, validatedProof, audit);
        await transaction.revokeCertificate({
          certificate,
          actorUserId: actor.userId,
          reasonCode: normalizedCommand.input.reasonCode,
          ...(normalizedCommand.input.reasonNote
            ? { reasonNote: normalizedCommand.input.reasonNote }
            : {}),
          revokedAt: validatedProof.now,
          idempotencyKey: normalizedCommand.idempotencyKey,
          requestFingerprint,
          responseEnvelope: response,
          audit,
        });
        return response;
      });
    } catch (error: unknown) {
      if (error instanceof CertificateIssuanceRepositoryConflictError) {
        const committedReplay = replayRevocation(
          await this.repository.findIdempotencyRecord(
            actor.userId,
            normalizedCommand.idempotencyKey,
          ),
          requestFingerprint,
        );
        if (committedReplay) return committedReplay;
        throw certificateVersionConflict();
      }
      throw error;
    }
  }

  async getOwnCertificate(
    certificateId: string,
    actor: CertificateActor,
    audit: CertificateAuditContext,
  ): Promise<PrivateCertificateDto> {
    assertSelfPolicy(actor, 'certificates.self_read');
    const record = await this.repository.findCertificate(certificateId);
    if (!record || record.studentId !== actor.userId) throw certificateNotFound();
    try {
      await this.repository.recordDetailAccess(certificateId, 'self', audit);
    } catch (error: unknown) {
      if (error instanceof CertificateRateLimitRepositoryError) throw certificateRateLimited();
      throw error;
    }
    return presentPrivateCertificate(record, actor, 'self');
  }

  async getCourseCertificate(
    courseId: string,
    certificateId: string,
    actor: CertificateActor,
    audit: CertificateAuditContext,
  ): Promise<PrivateCertificateDto> {
    assertCourseReadPolicy(actor);
    const record = await this.repository.findCertificate(certificateId);
    if (!record || record.courseId !== courseId) throw certificateNotFound();
    if (!actor.roles.includes(RoleCode.ADMIN) && record.teacherId !== actor.userId) {
      throw certificateCourseScopeDenied();
    }
    try {
      await this.repository.recordDetailAccess(certificateId, 'course', audit);
    } catch (error: unknown) {
      if (error instanceof CertificateRateLimitRepositoryError) throw certificateRateLimited();
      throw error;
    }
    const result = presentPrivateCertificate(record, actor, 'course');
    await this.repository.recordPrivilegedView(certificateId, courseId, audit);
    return result;
  }

  async downloadOwnCertificate(
    certificateId: string,
    actor: CertificateActor,
    audit: CertificateAuditContext,
  ): Promise<CertificateDownload> {
    assertSelfPolicy(actor, 'certificates.self_download');
    const record = await this.repository.findCertificate(certificateId);
    if (!record || record.studentId !== actor.userId) throw certificateNotFound();
    if (record.status === CertificateLifecycleStatus.REVOKED) throw certificateRevoked();
    return this.download(record, actor, 'student', audit);
  }

  async downloadCourseCertificate(
    courseId: string,
    certificateId: string,
    actor: CertificateActor,
    audit: CertificateAuditContext,
  ): Promise<CertificateDownload> {
    assertCourseDownloadPolicy(actor);
    const record = await this.repository.findCertificate(certificateId);
    if (!record || record.courseId !== courseId) throw certificateNotFound();
    return this.download(record, actor, 'admin', audit);
  }

  private async download(
    record: CertificateDetailRecord,
    _actor: CertificateActor,
    actorClass: 'student' | 'admin',
    audit: CertificateAuditContext,
  ): Promise<CertificateDownload> {
    if (!record?.artifact) throw certificateArtifactUnavailable();
    let resolved;
    try {
      resolved = await this.artifacts.resolveFinalizedCertificateArtifact(record.artifact.id);
    } catch (error: unknown) {
      const classification =
        error instanceof CertificateArtifactError ? error.category : 'ARTIFACT_RESOLUTION_FAILED';
      reportOperationalAlert(audit, {
        event: 'certificate.artifact_integrity_alert',
        certificateId: record.id,
        artifactId: record.artifact.id,
        classification,
      });
      throw certificateArtifactUnavailable();
    }
    try {
      await this.repository.recordDownloadStarted(record.id, actorClass, audit);
    } catch (error: unknown) {
      if (error instanceof CertificateRateLimitRepositoryError) {
        throw certificateRateLimited();
      }
      throw error;
    }
    return {
      certificateId: record.id,
      certificateNumber: record.certificateNumber,
      mimeType: 'application/pdf',
      contentLength: resolved.contentLength,
      checksum: resolved.metadata.checksum,
      stream: resolved.stream,
    };
  }
}
