import {
  CertificateLifecycleStatus,
  CertificateTemplateVersionStatus,
  IdempotencyOperation,
  Prisma,
  type PrismaClient,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { prisma } from '../../infrastructure/database/prisma.js';
import { PrismaStepUpTransactionRepository } from '../step-up-authentication/step-up-authentication.repository.js';
import type { StepUpTransactionRepository } from '../step-up-authentication/step-up-authentication.repository.js';
import {
  CertificateIssuanceRepositoryConflictError,
  CertificateRateLimitRepositoryError,
} from './certificate-issuance.errors.js';
import type {
  AllocatedCertificateIdentity,
  CertificateArtifactPersistenceData,
  CertificateAuditContext,
  CertificateDetailRecord,
  CertificateIssuanceCandidate,
  CertificateImmutableSnapshot,
  CertificateMutationResponse,
  CertificateTemplateVersionRecord,
  StoredIdempotencyReceipt,
} from './certificate-issuance.types.js';

const MAX_TRANSACTION_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 10;
const RETRY_MAX_DELAY_MS = 100;
const TEMPLATE_CODE = 'STANDARD_COURSE_COMPLETION';
const TEMPLATE_LOCALE = 'uz-Latn';

function auditFields(context: CertificateAuditContext) {
  return {
    actorUserId: context.actorUserId,
    ...(context.requestCorrelationId ? { requestCorrelationId: context.requestCorrelationId } : {}),
    ...(context.ipHash ? { ipHash: context.ipHash } : {}),
    ...(context.userAgentSummary ? { userAgentSummary: context.userAgentSummary } : {}),
  };
}

function generateUuidV7(now: Date): string {
  const bytes = randomBytes(16);
  let timestamp = BigInt(now.getTime());
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = Number(timestamp & 0xffn);
    timestamp >>= 8n;
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20,
  )}-${hex.slice(20)}`;
}

function isSerializationConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === 'P2034') return true;
  return error.code === 'P2010' && (error.meta?.code === '40001' || error.meta?.code === '40P01');
}

function uniqueTargets(error: Prisma.PrismaClientKnownRequestError): string[] {
  const target = error.meta?.target;
  if (typeof target === 'string') return [target];
  return Array.isArray(target)
    ? target.filter((value): value is string => typeof value === 'string')
    : [];
}

function hasTarget(error: Prisma.PrismaClientKnownRequestError, ...expected: string[]): boolean {
  const targets = uniqueTargets(error);
  return expected.some((value) => targets.some((target) => target.includes(value)));
}

function classifyUniqueConflict(
  error: Prisma.PrismaClientKnownRequestError,
): CertificateIssuanceRepositoryConflictError | null {
  if (error.code !== 'P2002') return null;
  if (
    hasTarget(
      error,
      'certificates_enrollment_id_key',
      'certificates_enrollment_course_key',
      'certificates_eligibility_evaluation_id_key',
      'enrollment_id',
      'enrollmentId',
      'eligibility_evaluation_id',
      'eligibilityEvaluationId',
    )
  ) {
    return new CertificateIssuanceRepositoryConflictError('already-issued');
  }
  if (
    hasTarget(error, 'idempotency_records_actor_user_id_key_key', 'actor_user_id', 'actorUserId')
  ) {
    return new CertificateIssuanceRepositoryConflictError('idempotency');
  }
  if (
    hasTarget(
      error,
      'certificates_certificate_number_key',
      'certificates_verification_token_hash_key',
      'certificate_number',
      'certificateNumber',
      'verification_token_hash',
      'verificationTokenHash',
    )
  ) {
    return new CertificateIssuanceRepositoryConflictError('numbering');
  }
  return null;
}

const templateVersionSelect = {
  id: true,
  version: true,
  locale: true,
  status: true,
  rendererContractVersion: true,
  organizationDisplayName: true,
  signatoryName: true,
  signatoryTitle: true,
  fontAssetId: true,
  fontAssetChecksum: true,
  fontFamily: true,
  fontVersion: true,
  fontLicenseIdentifier: true,
  fontLicenseProvenance: true,
  template: { select: { code: true } },
} satisfies Prisma.CertificateTemplateVersionSelect;

const certificateDetailSelect = {
  id: true,
  certificateNumber: true,
  enrollmentId: true,
  courseTitle: true,
  recipientDisplayName: true,
  organizationName: true,
  locale: true,
  status: true,
  version: true,
  issuedAt: true,
  revokedAt: true,
  revocationReasonCode: true,
  enrollment: {
    select: {
      studentId: true,
      course: { select: { title: true, slug: true, teacherId: true } },
    },
  },
  courseId: true,
  templateVersion: { select: { version: true } },
  artifact: {
    select: { id: true, mimeType: true, sizeBytes: true, checksum: true },
  },
} satisfies Prisma.CertificateSelect;

type CertificateDetailPayload = Prisma.CertificateGetPayload<{
  select: typeof certificateDetailSelect;
}>;

function mapTemplateVersion(
  record: Prisma.CertificateTemplateVersionGetPayload<{
    select: typeof templateVersionSelect;
  }>,
): CertificateTemplateVersionRecord {
  return {
    id: record.id,
    version: record.version,
    locale: record.locale,
    status: record.status,
    rendererContractVersion: record.rendererContractVersion,
    organizationDisplayName: record.organizationDisplayName,
    signatoryName: record.signatoryName,
    signatoryTitle: record.signatoryTitle,
    fontAssetId: record.fontAssetId,
    fontAssetChecksum: record.fontAssetChecksum,
    fontFamily: record.fontFamily,
    fontVersion: record.fontVersion,
    fontLicenseIdentifier: record.fontLicenseIdentifier,
    fontLicenseProvenance: record.fontLicenseProvenance,
    templateCode: record.template.code,
  };
}

function mapCertificateDetail(record: CertificateDetailPayload): CertificateDetailRecord {
  return {
    id: record.id,
    certificateNumber: record.certificateNumber,
    enrollmentId: record.enrollmentId,
    studentId: record.enrollment.studentId,
    courseId: record.courseId,
    courseTitle: record.courseTitle,
    courseSlug: record.enrollment.course.slug,
    teacherId: record.enrollment.course.teacherId,
    recipientDisplayName: record.recipientDisplayName,
    organizationName: record.organizationName,
    locale: record.locale,
    status: record.status,
    version: record.version,
    issuedAt: record.issuedAt,
    revokedAt: record.revokedAt,
    revocationReasonCode: record.revocationReasonCode,
    templateVersion: record.templateVersion.version,
    artifact: record.artifact,
  };
}

async function findCandidate(
  client: Prisma.TransactionClient | PrismaClient,
  enrollmentId: string,
  eligibilityEvaluationId: string,
): Promise<CertificateIssuanceCandidate | null> {
  const enrollment = await client.courseEnrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      courseId: true,
      studentId: true,
      status: true,
      completedAt: true,
      student: {
        select: {
          displayName: true,
          firstName: true,
          lastName: true,
          status: true,
          deletedAt: true,
        },
      },
      course: {
        select: { title: true, slug: true, deletedAt: true },
      },
      progressRoot: {
        select: {
          completionVersion: true,
          curriculumVersion: true,
          frozenAt: true,
          completedEligibleBlocks: true,
          totalEligibleBlocks: true,
          completedLessons: true,
          totalEligibleLessons: true,
          coursePercentage: true,
        },
      },
      certificate: { select: { id: true } },
      eligibilityEvaluations: {
        orderBy: [{ evaluationVersion: 'desc' }],
        take: 1,
        select: { id: true },
      },
    },
  });
  if (!enrollment) return null;

  const [eligibility, template] = await Promise.all([
    client.certificateEligibilityEvaluation.findUnique({
      where: { id: eligibilityEvaluationId },
      select: {
        id: true,
        enrollmentId: true,
        courseId: true,
        status: true,
        evaluationVersion: true,
        completedAt: true,
        completionVersion: true,
        completionCurriculumVersion: true,
        completedLessons: true,
        totalEligibleLessons: true,
        coursePercentage: true,
        policy: {
          select: {
            code: true,
            version: true,
            assessmentRule: true,
            requiresAttendance: true,
            requiresManualApproval: true,
          },
        },
      },
    }),
    client.certificateTemplateVersion.findFirst({
      where: {
        locale: TEMPLATE_LOCALE,
        status: CertificateTemplateVersionStatus.ACTIVE,
        template: { code: TEMPLATE_CODE },
      },
      select: templateVersionSelect,
    }),
  ]);
  const canonicalCompletionEventCount =
    eligibility && enrollment.progressRoot && enrollment.completedAt
      ? await client.progressEvent.count({
          where: {
            enrollmentId: enrollment.id,
            eventType: 'COURSE_COMPLETED',
            lessonId: null,
            blockId: null,
            newState: 'COMPLETED',
            curriculumVersion: eligibility.completionCurriculumVersion,
            resultingCompletionVersion: eligibility.completionVersion,
            snapshotCompletedEligibleBlocks: enrollment.progressRoot.completedEligibleBlocks,
            snapshotTotalEligibleBlocks: enrollment.progressRoot.totalEligibleBlocks,
            snapshotCompletedLessons: enrollment.progressRoot.completedLessons,
            snapshotTotalEligibleLessons: enrollment.progressRoot.totalEligibleLessons,
            snapshotCoursePercentage: enrollment.progressRoot.coursePercentage,
            occurredAt: enrollment.completedAt,
          },
        })
      : 0;
  const displayName =
    enrollment.student.displayName?.trim() ||
    [enrollment.student.firstName, enrollment.student.lastName].filter(Boolean).join(' ').trim();

  return {
    enrollmentId: enrollment.id,
    courseId: enrollment.courseId,
    studentId: enrollment.studentId,
    enrollmentStatus: enrollment.status,
    completedAt: enrollment.completedAt,
    courseTitle: enrollment.course.title,
    courseSlug: enrollment.course.slug,
    courseDeletedAt: enrollment.course.deletedAt,
    recipientDisplayName: displayName || null,
    studentStatus: enrollment.student.status,
    studentDeletedAt: enrollment.student.deletedAt,
    progressRoot: enrollment.progressRoot,
    eligibility:
      eligibility &&
      eligibility.enrollmentId === enrollment.id &&
      eligibility.courseId === enrollment.courseId
        ? {
            id: eligibility.id,
            status: eligibility.status,
            evaluationVersion: eligibility.evaluationVersion,
            completedAt: eligibility.completedAt,
            completionVersion: eligibility.completionVersion,
            completionCurriculumVersion: eligibility.completionCurriculumVersion,
            completedLessons: eligibility.completedLessons,
            totalEligibleLessons: eligibility.totalEligibleLessons,
            coursePercentage: eligibility.coursePercentage,
            policyCode: eligibility.policy.code,
            policyVersion: eligibility.policy.version,
            assessmentRule: eligibility.policy.assessmentRule,
            requiresAttendance: eligibility.policy.requiresAttendance,
            requiresManualApproval: eligibility.policy.requiresManualApproval,
          }
        : null,
    latestEligibilityEvaluationId: enrollment.eligibilityEvaluations[0]?.id ?? null,
    canonicalCompletionEventCount,
    templateVersion: template ? mapTemplateVersion(template) : null,
    existingCertificateId: enrollment.certificate?.id ?? null,
  };
}

export interface CreateIssuedCertificateData {
  readonly identity: AllocatedCertificateIdentity;
  readonly candidate: CertificateIssuanceCandidate;
  readonly snapshot: CertificateImmutableSnapshot;
  readonly verificationTokenHash: string;
  readonly artifact: CertificateArtifactPersistenceData;
  readonly actorUserId: string;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
  readonly responseEnvelope: CertificateMutationResponse;
  readonly audit: CertificateAuditContext;
}

export interface CertificateIssuanceTransaction {
  readonly stepUp: StepUpTransactionRepository;
  lockEvidence(
    enrollmentId: string,
    eligibilityEvaluationId: string,
    templateVersionId: string,
  ): Promise<void>;
  findCandidate(
    enrollmentId: string,
    eligibilityEvaluationId: string,
  ): Promise<CertificateIssuanceCandidate | null>;
  findIdempotencyRecord(actorUserId: string, key: string): Promise<StoredIdempotencyReceipt | null>;
  createIssuedCertificate(data: CreateIssuedCertificateData): Promise<void>;
}

export interface CertificateIssuanceRepository {
  allocateIdentity(): Promise<AllocatedCertificateIdentity>;
  findCandidate(
    enrollmentId: string,
    eligibilityEvaluationId: string,
  ): Promise<CertificateIssuanceCandidate | null>;
  findIdempotencyRecord(actorUserId: string, key: string): Promise<StoredIdempotencyReceipt | null>;
  withSerializableTransaction<T>(
    operation: (transaction: CertificateIssuanceTransaction, attempt: number) => Promise<T>,
  ): Promise<T>;
  recordIssueRequested(
    enrollmentId: string,
    evaluationId: string,
    fingerprintReference: string,
    templateVersion: number,
    context: CertificateAuditContext,
  ): Promise<void>;
  recordIssueFailed(
    enrollmentId: string,
    phase: string,
    reason: string,
    attempt: number,
    context: CertificateAuditContext,
  ): Promise<void>;
  findCertificate(certificateId: string): Promise<CertificateDetailRecord | null>;
  recordDetailAccess(
    certificateId: string,
    scope: 'self' | 'course',
    context: CertificateAuditContext,
  ): Promise<void>;
  recordPrivilegedView(
    certificateId: string,
    courseId: string,
    context: CertificateAuditContext,
  ): Promise<void>;
  recordDownloadStarted(
    certificateId: string,
    actorClass: 'student' | 'admin',
    context: CertificateAuditContext,
  ): Promise<void>;
}

class PrismaCertificateIssuanceTransaction implements CertificateIssuanceTransaction {
  readonly stepUp: StepUpTransactionRepository;

  constructor(private readonly transaction: Prisma.TransactionClient) {
    this.stepUp = new PrismaStepUpTransactionRepository(transaction);
  }

  async lockEvidence(
    enrollmentId: string,
    eligibilityEvaluationId: string,
    templateVersionId: string,
  ): Promise<void> {
    // Canonical issuance mutex. All issuance paths lock the enrollment before
    // progress, evaluation, and template evidence, and before proof consumption.
    await this.transaction.$queryRaw`
      SELECT "id" FROM "course_enrollments"
      WHERE "id" = ${enrollmentId}::uuid
      FOR UPDATE
    `;
    await this.transaction.$queryRaw`
      SELECT "id" FROM "enrollment_progress_roots"
      WHERE "enrollment_id" = ${enrollmentId}::uuid
      FOR SHARE
    `;
    await this.transaction.$queryRaw`
      SELECT "id" FROM "certificate_eligibility_evaluations"
      WHERE "id" = ${eligibilityEvaluationId}::uuid
      FOR SHARE
    `;
    await this.transaction.$queryRaw`
      SELECT "id" FROM "certificate_template_versions"
      WHERE "id" = ${templateVersionId}::uuid
      FOR SHARE
    `;
  }

  findCandidate(
    enrollmentId: string,
    eligibilityEvaluationId: string,
  ): Promise<CertificateIssuanceCandidate | null> {
    return findCandidate(this.transaction, enrollmentId, eligibilityEvaluationId);
  }

  async findIdempotencyRecord(
    actorUserId: string,
    key: string,
  ): Promise<StoredIdempotencyReceipt | null> {
    return this.transaction.idempotencyRecord.findUnique({
      where: { actorUserId_key: { actorUserId, key } },
      select: {
        operation: true,
        requestFingerprint: true,
        responseStatus: true,
        responseEnvelope: true,
        expiresAt: true,
      },
    });
  }

  async createIssuedCertificate(data: CreateIssuedCertificateData): Promise<void> {
    const template = data.candidate.templateVersion;
    const eligibility = data.candidate.eligibility;
    if (!template || !eligibility || !data.candidate.completedAt) {
      throw new CertificateIssuanceRepositoryConflictError('serialization');
    }
    const issueDate = new Date(
      Date.UTC(
        data.identity.issuedAt.getUTCFullYear(),
        data.identity.issuedAt.getUTCMonth(),
        data.identity.issuedAt.getUTCDate(),
      ),
    );
    const timestamps = await this.transaction.$queryRaw<{ currentTime: Date }[]>`
      SELECT clock_timestamp() AS "currentTime"
    `;
    const currentTime = timestamps[0]?.currentTime;
    if (!currentTime) {
      throw new CertificateIssuanceRepositoryConflictError('serialization');
    }
    const certificate = await this.transaction.certificate.create({
      data: {
        id: data.identity.certificateId,
        certificateNumber: data.identity.certificateNumber,
        verificationTokenHash: data.verificationTokenHash,
        enrollmentId: data.candidate.enrollmentId,
        courseId: data.candidate.courseId,
        eligibilityEvaluationId: eligibility.id,
        templateVersionId: template.id,
        status: CertificateLifecycleStatus.ISSUED,
        version: 1,
        recipientDisplayName: data.snapshot.recipientDisplayName,
        courseTitle: data.snapshot.courseTitle,
        organizationName: data.snapshot.organizationName,
        locale: data.snapshot.locale,
        issueDate,
        issuedAt: data.identity.issuedAt,
        issuedByUserId: data.actorUserId,
        createdAt: currentTime,
        updatedAt: currentTime,
        artifact: {
          create: {
            ...data.artifact,
            finalizedAt: currentTime,
            createdAt: currentTime,
          },
        },
      },
      select: { id: true },
    });
    await this.transaction.auditLog.create({
      data: {
        ...auditFields(data.audit),
        action: 'certificate.issued',
        subjectType: 'certificate',
        subjectId: certificate.id,
        metadata: {
          enrollmentId: data.candidate.enrollmentId,
          courseId: data.candidate.courseId,
          certificateNumber: data.identity.certificateNumber,
          eligibilityEvaluationId: eligibility.id,
          evaluationVersion: eligibility.evaluationVersion,
          completionVersion: eligibility.completionVersion,
          curriculumVersion: eligibility.completionCurriculumVersion,
          templateVersion: template.version,
          checksumPrefix: data.artifact.checksum.slice(0, 12),
        },
      },
    });
    await this.transaction.idempotencyRecord.create({
      data: {
        actorUserId: data.actorUserId,
        enrollmentId: data.candidate.enrollmentId,
        key: data.idempotencyKey,
        operation: IdempotencyOperation.ISSUE_CERTIFICATE,
        requestFingerprint: data.requestFingerprint,
        responseStatus: 201,
        responseEnvelope: JSON.parse(
          JSON.stringify(data.responseEnvelope),
        ) as Prisma.InputJsonValue,
        resultingCertificateId: certificate.id,
        resultingCertificateVersion: 1,
        expiresAt: new Date(data.identity.issuedAt.getTime() + 24 * 60 * 60_000),
      },
    });
  }
}

export class PrismaCertificateIssuanceRepository implements CertificateIssuanceRepository {
  constructor(
    private readonly client: PrismaClient = prisma,
    private readonly retry: {
      readonly sleep: (milliseconds: number) => Promise<void>;
      readonly random: () => number;
    } = {
      sleep: (milliseconds) =>
        new Promise((resolve) => {
          setTimeout(resolve, milliseconds);
        }),
      random: Math.random,
    },
  ) {}

  async allocateIdentity(): Promise<AllocatedCertificateIdentity> {
    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      const rows = await this.client.$queryRaw<{ certificateNumber: string; issuedAt: Date }[]>`
        SELECT
          generate_certificate_number() AS "certificateNumber",
          clock_timestamp() AS "issuedAt"
      `;
      const identity = rows[0];
      if (!identity) break;
      const collision = await this.client.certificate.findUnique({
        where: { certificateNumber: identity.certificateNumber },
        select: { id: true },
      });
      if (!collision) {
        return {
          certificateId: generateUuidV7(identity.issuedAt),
          certificateNumber: identity.certificateNumber,
          issuedAt: identity.issuedAt,
        };
      }
    }
    throw new CertificateIssuanceRepositoryConflictError('numbering');
  }

  findCandidate(
    enrollmentId: string,
    eligibilityEvaluationId: string,
  ): Promise<CertificateIssuanceCandidate | null> {
    return findCandidate(this.client, enrollmentId, eligibilityEvaluationId);
  }

  async findIdempotencyRecord(
    actorUserId: string,
    key: string,
  ): Promise<StoredIdempotencyReceipt | null> {
    return this.client.idempotencyRecord.findUnique({
      where: { actorUserId_key: { actorUserId, key } },
      select: {
        operation: true,
        requestFingerprint: true,
        responseStatus: true,
        responseEnvelope: true,
        expiresAt: true,
      },
    });
  }

  async withSerializableTransaction<T>(
    operation: (transaction: CertificateIssuanceTransaction, attempt: number) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        return await this.client.$transaction(
          (transaction) =>
            operation(new PrismaCertificateIssuanceTransaction(transaction), attempt),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error: unknown) {
        const uniqueConflict =
          error instanceof Prisma.PrismaClientKnownRequestError
            ? classifyUniqueConflict(error)
            : null;
        if (uniqueConflict?.kind === 'numbering') throw uniqueConflict;
        if (!isSerializationConflict(error) && !uniqueConflict) throw error;
        if (attempt === MAX_TRANSACTION_ATTEMPTS) {
          throw new CertificateIssuanceRepositoryConflictError(
            uniqueConflict?.kind === 'already-issued' ? 'already-issued' : 'serialization',
            attempt,
          );
        }
        const maximumDelay = Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
        const jitteredDelay = Math.floor(this.retry.random() * (maximumDelay + 1));
        await this.retry.sleep(jitteredDelay);
      }
    }
    throw new CertificateIssuanceRepositoryConflictError('serialization');
  }

  async recordIssueRequested(
    enrollmentId: string,
    evaluationId: string,
    fingerprintReference: string,
    templateVersion: number,
    context: CertificateAuditContext,
  ): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        WITH "rate_limit_lock" AS MATERIALIZED (
          SELECT pg_advisory_xact_lock(
            hashtextextended(${'certificate:issue:' + context.actorUserId + ':' + enrollmentId}, 0)
          )
        )
        SELECT 1::INTEGER AS "lockAcquired"
        FROM "rate_limit_lock"
      `;
      const timestamps = await transaction.$queryRaw<{ currentTime: Date }[]>`
        SELECT clock_timestamp() AS "currentTime"
      `;
      const currentTime = timestamps[0]?.currentTime;
      if (!currentTime) throw new CertificateIssuanceRepositoryConflictError('serialization');
      const since = new Date(currentTime.getTime() - 15 * 60_000);
      const count = await transaction.auditLog.count({
        where: {
          actorUserId: context.actorUserId,
          action: 'certificate.issue_requested',
          subjectId: enrollmentId,
          occurredAt: { gte: since },
        },
      });
      if (count >= 5) {
        throw new CertificateRateLimitRepositoryError();
      }
      await transaction.auditLog.create({
        data: {
          ...auditFields(context),
          action: 'certificate.issue_requested',
          subjectType: 'course_enrollment',
          subjectId: enrollmentId,
          metadata: {
            eligibilityEvaluationId: evaluationId,
            fingerprintReference,
            templateVersion,
          },
        },
      });
    });
  }

  async recordIssueFailed(
    enrollmentId: string,
    phase: string,
    reason: string,
    attempt: number,
    context: CertificateAuditContext,
  ): Promise<void> {
    await this.client.auditLog.create({
      data: {
        ...auditFields(context),
        action: 'certificate.issue_failed',
        subjectType: 'course_enrollment',
        subjectId: enrollmentId,
        metadata: { phase, reason, attempt },
      },
    });
  }

  async findCertificate(certificateId: string): Promise<CertificateDetailRecord | null> {
    const record = await this.client.certificate.findUnique({
      where: { id: certificateId },
      select: certificateDetailSelect,
    });
    return record ? mapCertificateDetail(record) : null;
  }

  async recordDetailAccess(
    certificateId: string,
    scope: 'self' | 'course',
    context: CertificateAuditContext,
  ): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      const rateScope = `certificate:detail:${scope}:${context.actorUserId}`;
      await transaction.$queryRaw`
        WITH "rate_limit_lock" AS MATERIALIZED (
          SELECT pg_advisory_xact_lock(hashtextextended(${rateScope}, 0))
        )
        SELECT 1::INTEGER AS "lockAcquired" FROM "rate_limit_lock"
      `;
      const timestamps = await transaction.$queryRaw<{ currentTime: Date }[]>`
        SELECT clock_timestamp() AS "currentTime"
      `;
      const currentTime = timestamps[0]?.currentTime;
      if (!currentTime) throw new CertificateIssuanceRepositoryConflictError('serialization');
      const since = new Date(currentTime.getTime() - 60_000);
      const count = await transaction.auditLog.count({
        where: {
          actorUserId: context.actorUserId,
          action: 'certificate.detail_accessed',
          metadata: { path: ['scope'], equals: scope },
          occurredAt: { gte: since },
        },
      });
      if (count >= 60) throw new CertificateRateLimitRepositoryError();
      await transaction.auditLog.create({
        data: {
          ...auditFields(context),
          action: 'certificate.detail_accessed',
          subjectType: 'certificate',
          subjectId: certificateId,
          metadata: { scope },
        },
      });
    });
  }

  async recordPrivilegedView(
    certificateId: string,
    courseId: string,
    context: CertificateAuditContext,
  ): Promise<void> {
    await this.client.auditLog.create({
      data: {
        ...auditFields(context),
        action: 'certificate.privileged_viewed',
        subjectType: 'certificate',
        subjectId: certificateId,
        metadata: { courseId },
      },
    });
  }

  async recordDownloadStarted(
    certificateId: string,
    actorClass: 'student' | 'admin',
    context: CertificateAuditContext,
  ): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      // Every download path takes the actor lock before the certificate lock so
      // both shared buckets remain race-safe without introducing lock inversion.
      await transaction.$queryRaw`
        WITH "rate_limit_lock" AS MATERIALIZED (
          SELECT pg_advisory_xact_lock(
            hashtextextended(${'certificate:download:actor:' + context.actorUserId}, 0)
          )
        )
        SELECT 1::INTEGER AS "lockAcquired"
        FROM "rate_limit_lock"
      `;
      await transaction.$queryRaw`
        WITH "rate_limit_lock" AS MATERIALIZED (
          SELECT pg_advisory_xact_lock(
            hashtextextended(${'certificate:download:certificate:' + certificateId}, 0)
          )
        )
        SELECT 1::INTEGER AS "lockAcquired"
        FROM "rate_limit_lock"
      `;
      const timestamps = await transaction.$queryRaw<{ currentTime: Date }[]>`
        SELECT clock_timestamp() AS "currentTime"
      `;
      const currentTime = timestamps[0]?.currentTime;
      if (!currentTime) throw new CertificateIssuanceRepositoryConflictError('serialization');
      const since = new Date(currentTime.getTime() - 60_000);
      const [actorCount, certificateCount] = await Promise.all([
        transaction.auditLog.count({
          where: {
            actorUserId: context.actorUserId,
            action: 'certificate.download_started',
            occurredAt: { gte: since },
          },
        }),
        transaction.auditLog.count({
          where: {
            subjectId: certificateId,
            action: 'certificate.download_started',
            occurredAt: { gte: since },
          },
        }),
      ]);
      if (actorCount >= 20 || certificateCount >= 5) {
        throw new CertificateRateLimitRepositoryError();
      }
      await transaction.auditLog.create({
        data: {
          ...auditFields(context),
          action: 'certificate.download_started',
          subjectType: 'certificate',
          subjectId: certificateId,
          metadata: { actorClass, disposition: 'attachment' },
        },
      });
    });
  }
}
