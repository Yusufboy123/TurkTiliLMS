import {
  CertificateEligibilityEvaluatorType,
  CertificateEligibilityStatus,
  CourseEnrollmentStatus,
} from '@prisma/client';
import { canDownloadCertificate } from '../certificate-issuance/certificate-download-policy.js';
import { completionEvidenceConflict } from './certificate-eligibility.errors.js';
import type {
  CertificateCapabilitiesDto,
  CertificateEligibilityActor,
  CertificateEligibilityDto,
  CertificateStatusDto,
  EligibilityEnrollmentRecord,
} from './certificate-eligibility.types.js';

export function certificateCapabilities(options: {
  canReadEligibility: boolean;
  canReadCertificateStatus: boolean;
}): CertificateCapabilitiesDto {
  return {
    ...options,
    canIssueCertificate: false,
    canRevokeCertificate: false,
  };
}

function courseReference(record: EligibilityEnrollmentRecord) {
  return {
    id: record.course.id,
    title: record.course.title,
    slug: record.course.slug,
  };
}

export function presentIncompleteEligibility(
  record: EligibilityEnrollmentRecord,
  capabilities: CertificateCapabilitiesDto,
): CertificateEligibilityDto {
  const root = record.progressRoot;
  return {
    enrollmentId: record.id,
    course: courseReference(record),
    completion: {
      status: 'NOT_COMPLETED',
      completedAt: null,
      completionCurriculumVersion: null,
      completionVersion: null,
      completedLessons: root?.completedLessons ?? 0,
      totalEligibleLessons: root?.totalEligibleLessons ?? 0,
      percentage: root?.coursePercentage ?? 0,
    },
    eligibility: {
      id: null,
      status: 'NOT_COMPLETED',
      policyCode: null,
      policyVersion: null,
      evaluationVersion: null,
      evaluatedAt: null,
      reasonCodes: ['COURSE_NOT_COMPLETED'],
    },
    capabilities,
  };
}

export function presentCompletedEligibility(
  record: EligibilityEnrollmentRecord,
  capabilities: CertificateCapabilitiesDto,
): CertificateEligibilityDto {
  const root = record.progressRoot;
  const evaluation = record.eligibilityEvaluations[0];
  if (
    record.status !== CourseEnrollmentStatus.COMPLETED ||
    !record.completedAt ||
    !root ||
    !root.frozenAt ||
    root.frozenAt.getTime() !== record.completedAt.getTime() ||
    root.completedLessons <= 0 ||
    root.completedLessons !== root.totalEligibleLessons ||
    root.coursePercentage !== 100 ||
    !evaluation ||
    evaluation.status !== CertificateEligibilityStatus.ELIGIBLE ||
    evaluation.enrollmentId !== record.id ||
    evaluation.courseId !== record.courseId ||
    evaluation.completedAt.getTime() !== record.completedAt.getTime() ||
    evaluation.completionCurriculumVersion !== root.curriculumVersion ||
    evaluation.completionVersion !== root.completionVersion ||
    evaluation.completedLessons !== root.completedLessons ||
    evaluation.totalEligibleLessons !== root.totalEligibleLessons ||
    evaluation.coursePercentage !== root.coursePercentage ||
    evaluation.evaluatorType !== CertificateEligibilityEvaluatorType.SYSTEM ||
    evaluation.evaluatedByUserId !== null ||
    evaluation.policy.code !== 'COURSE_COMPLETION_ONLY' ||
    evaluation.policy.version !== 1 ||
    evaluation.policy.assessmentRule !== 'NONE' ||
    evaluation.policy.requiresAttendance ||
    evaluation.policy.requiresManualApproval ||
    evaluation.reasons.length > 0
  ) {
    throw completionEvidenceConflict();
  }

  return {
    enrollmentId: record.id,
    course: courseReference(record),
    completion: {
      status: 'COMPLETED',
      completedAt: record.completedAt.toISOString(),
      completionCurriculumVersion: root.curriculumVersion,
      completionVersion: root.completionVersion,
      completedLessons: root.completedLessons,
      totalEligibleLessons: root.totalEligibleLessons,
      percentage: root.coursePercentage,
    },
    eligibility: {
      id: evaluation.id,
      status: 'ELIGIBLE',
      policyCode: 'COURSE_COMPLETION_ONLY',
      policyVersion: evaluation.policy.version,
      evaluationVersion: evaluation.evaluationVersion,
      evaluatedAt: evaluation.evaluatedAt.toISOString(),
      reasonCodes: [],
    },
    capabilities,
  };
}

export function presentCertificateStatus(
  record: EligibilityEnrollmentRecord,
  capabilities: CertificateCapabilitiesDto,
  actor: CertificateEligibilityActor,
  scope: 'self' | 'course',
): CertificateStatusDto {
  const certificate = record.certificate;

  if (certificate) {
    return {
      enrollmentId: record.id,
      course: courseReference(record),
      status: certificate.status,
      certificate: {
        id: certificate.id,
        certificateId: certificate.id,
        certificateNumber: certificate.certificateNumber,
        status: certificate.status,
        issuedAt: certificate.issuedAt.toISOString(),
        revokedAt: certificate.revokedAt?.toISOString() ?? null,
        safeRevocationReasonCode: certificate.revocationReasonCode,
        version: certificate.version,
        canDownload: canDownloadCertificate(
          { status: certificate.status, hasArtifact: certificate.artifact !== null },
          actor,
          scope,
        ),
      },
      capabilities,
    };
  }

  return {
    enrollmentId: record.id,
    course: courseReference(record),
    status: 'NOT_ISSUED',
    certificate: null,
    capabilities,
  };
}
