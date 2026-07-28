import {
  CertificateEligibilityEvaluatorType,
  CertificateEligibilityPolicyCode,
  CertificateEligibilityStatus,
  ProgressEventState,
  ProgressEventType,
  type Prisma,
  type PrismaClient,
} from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type {
  CertificateEligibilityAuditContext,
  CertificateEligibilityCompletionTransaction,
  CourseCompletionEvidence,
  EligibilityEnrollmentRecord,
  EligibilityPolicyRecord,
  ExistingEligibilitySnapshotRecord,
} from './certificate-eligibility.types.js';

const eligibilityEnrollmentSelect = {
  id: true,
  courseId: true,
  studentId: true,
  status: true,
  completedAt: true,
  course: {
    select: {
      id: true,
      title: true,
      slug: true,
      teacherId: true,
    },
  },
  progressRoot: {
    select: {
      completionVersion: true,
      curriculumVersion: true,
      completedEligibleBlocks: true,
      totalEligibleBlocks: true,
      completedLessons: true,
      totalEligibleLessons: true,
      coursePercentage: true,
      frozenAt: true,
    },
  },
  eligibilityEvaluations: {
    orderBy: [{ evaluationVersion: 'desc' as const }],
    take: 1,
    select: {
      id: true,
      enrollmentId: true,
      courseId: true,
      policyId: true,
      status: true,
      evaluationVersion: true,
      evaluatedAt: true,
      completedAt: true,
      completionCurriculumVersion: true,
      completionVersion: true,
      completedLessons: true,
      totalEligibleLessons: true,
      coursePercentage: true,
      evaluatorType: true,
      evaluatedByUserId: true,
      policy: {
        select: {
          id: true,
          code: true,
          version: true,
          assessmentRule: true,
          requiresAttendance: true,
          requiresManualApproval: true,
        },
      },
      reasons: { select: { code: true }, orderBy: { code: 'asc' as const } },
    },
  },
} satisfies Prisma.CourseEnrollmentSelect;

function auditFields(context: CertificateEligibilityAuditContext) {
  return {
    actorUserId: context.actorUserId,
    ...(context.requestCorrelationId ? { requestCorrelationId: context.requestCorrelationId } : {}),
    ...(context.ipHash ? { ipHash: context.ipHash } : {}),
    ...(context.userAgentSummary ? { userAgentSummary: context.userAgentSummary } : {}),
  };
}

function canonicalCompletionEventWhere(
  evidence: CourseCompletionEvidence,
): Prisma.ProgressEventWhereInput {
  return {
    enrollmentId: evidence.enrollmentId,
    eventType: ProgressEventType.COURSE_COMPLETED,
    lessonId: null,
    blockId: null,
    newState: ProgressEventState.COMPLETED,
    curriculumVersion: evidence.completionCurriculumVersion,
    resultingCompletionVersion: evidence.completionVersion,
    snapshotCompletedEligibleBlocks: evidence.completedEligibleBlocks,
    snapshotTotalEligibleBlocks: evidence.totalEligibleBlocks,
    snapshotCompletedLessons: evidence.completedLessons,
    snapshotTotalEligibleLessons: evidence.totalEligibleLessons,
    snapshotCoursePercentage: evidence.coursePercentage,
    occurredAt: evidence.completedAt,
  };
}

export interface CertificateEligibilityRepository {
  findCourse(courseId: string): Promise<{ id: string; teacherId: string | null } | null>;
  findEnrollment(enrollmentId: string): Promise<EligibilityEnrollmentRecord | null>;
  countCanonicalCompletionEvents(evidence: CourseCompletionEvidence): Promise<number>;
  recordPrivilegedAccess(
    subjectId: string,
    view: 'eligibility' | 'certificate_status',
    courseId: string,
    evaluationVersion: number | null,
    context: CertificateEligibilityAuditContext,
  ): Promise<void>;
}

export class PrismaCertificateEligibilityRepository implements CertificateEligibilityRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async findCourse(courseId: string): Promise<{ id: string; teacherId: string | null } | null> {
    return this.client.course.findUnique({
      where: { id: courseId },
      select: { id: true, teacherId: true },
    });
  }

  async findEnrollment(enrollmentId: string): Promise<EligibilityEnrollmentRecord | null> {
    return this.client.courseEnrollment.findUnique({
      where: { id: enrollmentId },
      select: eligibilityEnrollmentSelect,
    });
  }

  async countCanonicalCompletionEvents(evidence: CourseCompletionEvidence): Promise<number> {
    return this.client.progressEvent.count({ where: canonicalCompletionEventWhere(evidence) });
  }

  async recordPrivilegedAccess(
    subjectId: string,
    view: 'eligibility' | 'certificate_status',
    courseId: string,
    evaluationVersion: number | null,
    context: CertificateEligibilityAuditContext,
  ): Promise<void> {
    await this.client.auditLog.create({
      data: {
        ...auditFields(context),
        action: 'certificate_eligibility.privileged_viewed',
        subjectType: 'course_enrollment',
        subjectId,
        metadata: { view, courseId, evaluationVersion },
      },
    });
  }
}

export class PrismaCertificateEligibilityCompletionRepository implements CertificateEligibilityCompletionTransaction {
  constructor(private readonly transaction: Prisma.TransactionClient) {}

  async getDatabaseTimestamp(): Promise<Date> {
    const rows = await this.transaction.$queryRaw<{ currentTime: Date }[]>`
      SELECT clock_timestamp() AS "currentTime"
    `;
    const currentTime = rows[0]?.currentTime;
    if (!currentTime) throw new Error('Database timestamp could not be read.');
    return currentTime;
  }

  async findV1EligibilityPolicy(): Promise<EligibilityPolicyRecord | null> {
    return this.transaction.certificateEligibilityPolicy.findUnique({
      where: {
        code_version: {
          code: CertificateEligibilityPolicyCode.COURSE_COMPLETION_ONLY,
          version: 1,
        },
      },
      select: {
        id: true,
        code: true,
        version: true,
        assessmentRule: true,
        requiresAttendance: true,
        requiresManualApproval: true,
      },
    });
  }

  async countCanonicalCompletionEvents(evidence: CourseCompletionEvidence): Promise<number> {
    return this.transaction.progressEvent.count({
      where: canonicalCompletionEventWhere(evidence),
    });
  }

  async hasCanonicalCompletionAuthority(evidence: CourseCompletionEvidence): Promise<boolean> {
    const count = await this.transaction.courseEnrollment.count({
      where: {
        id: evidence.enrollmentId,
        courseId: evidence.courseId,
        status: 'COMPLETED',
        completedAt: evidence.completedAt,
        progressRoot: {
          is: {
            frozenAt: evidence.completedAt,
            curriculumVersion: evidence.completionCurriculumVersion,
            completionVersion: evidence.completionVersion,
            completedEligibleBlocks: evidence.completedEligibleBlocks,
            totalEligibleBlocks: evidence.totalEligibleBlocks,
            completedLessons: evidence.completedLessons,
            totalEligibleLessons: evidence.totalEligibleLessons,
            coursePercentage: evidence.coursePercentage,
          },
        },
      },
    });
    return count === 1;
  }

  async findEligibilityEvaluationBySnapshot(
    enrollmentId: string,
    policyId: string,
    completionVersion: number,
  ): Promise<ExistingEligibilitySnapshotRecord | null> {
    return this.transaction.certificateEligibilityEvaluation.findUnique({
      where: {
        enrollmentId_policyId_completionVersion: {
          enrollmentId,
          policyId,
          completionVersion,
        },
      },
      select: {
        id: true,
        courseId: true,
        status: true,
        completedAt: true,
        completionCurriculumVersion: true,
        completionVersion: true,
        completedLessons: true,
        totalEligibleLessons: true,
        coursePercentage: true,
        evaluatorType: true,
        evaluatedByUserId: true,
      },
    });
  }

  async getNextEligibilityEvaluationVersion(enrollmentId: string): Promise<number> {
    const latest = await this.transaction.certificateEligibilityEvaluation.findFirst({
      where: { enrollmentId },
      orderBy: { evaluationVersion: 'desc' },
      select: { evaluationVersion: true },
    });
    return (latest?.evaluationVersion ?? 0) + 1;
  }

  async createEligibilityEvaluation(data: {
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
  }): Promise<{ id: string }> {
    return this.transaction.certificateEligibilityEvaluation.create({
      data: {
        ...data,
        status: CertificateEligibilityStatus.ELIGIBLE,
        evaluatorType: CertificateEligibilityEvaluatorType.SYSTEM,
        evaluatedByUserId: null,
        createdAt: data.evaluatedAt,
      },
      select: { id: true },
    });
  }
}
