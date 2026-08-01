import type {
  CertificateEligibilityAssessmentRule,
  CertificateEligibilityEvaluatorType,
  CertificateEligibilityPolicyCode,
  CertificateEligibilityStatus,
  CertificateLifecycleStatus,
  CertificateRevocationReasonCode,
  CourseEnrollmentStatus,
  RoleCode,
} from '@prisma/client';

export interface CertificateEligibilityActor {
  userId: string;
  roles: RoleCode[];
  permissions: string[];
}

export interface CertificateEligibilityAuditContext {
  actorUserId: string;
  requestCorrelationId?: string;
  ipHash?: string;
  userAgentSummary?: string;
}

export interface CourseCompletionEvidence {
  enrollmentId: string;
  courseId: string;
  completedAt: Date;
  completionCurriculumVersion: number;
  completionVersion: number;
  completedLessons: number;
  totalEligibleLessons: number;
  coursePercentage: number;
  completedEligibleBlocks: number;
  totalEligibleBlocks: number;
}

export interface EligibilityPolicyRecord {
  id: string;
  code: CertificateEligibilityPolicyCode;
  version: number;
  assessmentRule: CertificateEligibilityAssessmentRule;
  requiresAttendance: boolean;
  requiresManualApproval: boolean;
}

export interface EligibilityEvaluationRecord {
  id: string;
  enrollmentId: string;
  courseId: string;
  policyId: string;
  status: CertificateEligibilityStatus;
  evaluationVersion: number;
  evaluatedAt: Date;
  completedAt: Date;
  completionCurriculumVersion: number;
  completionVersion: number;
  completedLessons: number;
  totalEligibleLessons: number;
  coursePercentage: number;
  evaluatorType: CertificateEligibilityEvaluatorType;
  evaluatedByUserId: string | null;
  policy: EligibilityPolicyRecord;
  reasons: { code: string }[];
}

export interface ExistingEligibilitySnapshotRecord {
  id: string;
  courseId: string;
  status: CertificateEligibilityStatus;
  completedAt: Date;
  completionCurriculumVersion: number;
  completionVersion: number;
  completedLessons: number;
  totalEligibleLessons: number;
  coursePercentage: number;
  evaluatorType: CertificateEligibilityEvaluatorType;
  evaluatedByUserId: string | null;
}

export interface EligibilityEnrollmentRecord {
  id: string;
  courseId: string;
  studentId: string;
  status: CourseEnrollmentStatus;
  completedAt: Date | null;
  course: {
    id: string;
    title: string;
    slug: string;
    teacherId: string | null;
  };
  progressRoot: {
    completionVersion: number;
    curriculumVersion: number;
    completedEligibleBlocks: number;
    totalEligibleBlocks: number;
    completedLessons: number;
    totalEligibleLessons: number;
    coursePercentage: number;
    frozenAt: Date | null;
  } | null;
  eligibilityEvaluations: EligibilityEvaluationRecord[];
  certificate: {
    id: string;
    certificateNumber: string;
    status: CertificateLifecycleStatus;
    version: number;
    issuedAt: Date;
    revokedAt: Date | null;
    revocationReasonCode: CertificateRevocationReasonCode | null;
    artifact: { id: string } | null;
  } | null;
}

export interface CertificateCapabilitiesDto {
  canReadEligibility: boolean;
  canReadCertificateStatus: boolean;
  canIssueCertificate: false;
  canRevokeCertificate: false;
}

export interface CertificateEligibilityDto {
  enrollmentId: string;
  course: { id: string; title: string; slug: string };
  completion: {
    status: 'NOT_COMPLETED' | 'COMPLETED';
    completedAt: string | null;
    completionCurriculumVersion: number | null;
    completionVersion: number | null;
    completedLessons: number;
    totalEligibleLessons: number;
    percentage: number;
  };
  eligibility: {
    id: string | null;
    status: 'NOT_COMPLETED' | 'NOT_ELIGIBLE' | 'ELIGIBLE';
    policyCode: 'COURSE_COMPLETION_ONLY' | null;
    policyVersion: number | null;
    evaluationVersion: number | null;
    evaluatedAt: string | null;
    reasonCodes: string[];
  };
  capabilities: CertificateCapabilitiesDto;
}

export interface CertificateStatusDto {
  enrollmentId: string;
  course: { id: string; title: string; slug: string };
  status: 'NOT_ISSUED' | CertificateLifecycleStatus;
  certificate: {
    id: string;
    certificateId: string;
    certificateNumber: string;
    status: CertificateLifecycleStatus;
    issuedAt: string;
    revokedAt: string | null;
    safeRevocationReasonCode: CertificateRevocationReasonCode | null;
    version: number;
    canDownload: boolean;
  } | null;
  capabilities: CertificateCapabilitiesDto;
}

export interface CertificateEligibilityCompletionTransaction {
  getDatabaseTimestamp(): Promise<Date>;
  findV1EligibilityPolicy(): Promise<EligibilityPolicyRecord | null>;
  hasCanonicalCompletionAuthority(evidence: CourseCompletionEvidence): Promise<boolean>;
  countCanonicalCompletionEvents(evidence: CourseCompletionEvidence): Promise<number>;
  findEligibilityEvaluationBySnapshot(
    enrollmentId: string,
    policyId: string,
    completionVersion: number,
  ): Promise<ExistingEligibilitySnapshotRecord | null>;
  getNextEligibilityEvaluationVersion(enrollmentId: string): Promise<number>;
  createEligibilityEvaluation(data: {
    enrollmentId: string;
    courseId: string;
    policyId: string;
    evaluationVersion: number;
    evaluatedAt: Date;
    completedAt: Date;
    completionCurriculumVersion: number;
    completionVersion: number;
    completedLessons: number;
    totalEligibleLessons: number;
    coursePercentage: number;
  }): Promise<{ id: string }>;
}
