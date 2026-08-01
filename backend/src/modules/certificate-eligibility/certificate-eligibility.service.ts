import { CourseEnrollmentStatus, RoleCode } from '@prisma/client';
import {
  accessDenied,
  completionEvidenceConflict,
  courseNotFound,
  courseScopeDenied,
  enrollmentNotFound,
} from './certificate-eligibility.errors.js';
import {
  certificateCapabilities,
  presentCertificateStatus,
  presentCompletedEligibility,
  presentIncompleteEligibility,
} from './certificate-eligibility.presenter.js';
import type { CertificateEligibilityRepository } from './certificate-eligibility.repository.js';
import type {
  CertificateEligibilityActor,
  CertificateEligibilityAuditContext,
  CertificateEligibilityDto,
  CertificateStatusDto,
  CourseCompletionEvidence,
  EligibilityEnrollmentRecord,
} from './certificate-eligibility.types.js';

type CertificateReadKind = 'eligibility' | 'certificate_status';

function requiredPermission(kind: CertificateReadKind, scope: 'self' | 'course'): string {
  const resource = kind === 'eligibility' ? 'certificate_eligibility' : 'certificates';
  return `${resource}.${scope}_read`;
}

function assertSelfPolicy(actor: CertificateEligibilityActor, kind: CertificateReadKind): void {
  if (
    !actor.roles.includes(RoleCode.STUDENT) ||
    !actor.permissions.includes(requiredPermission(kind, 'self'))
  ) {
    throw accessDenied();
  }
}

function assertCoursePolicy(actor: CertificateEligibilityActor, kind: CertificateReadKind): void {
  if (
    !actor.roles.some((role) => role === RoleCode.ADMIN || role === RoleCode.TEACHER) ||
    !actor.permissions.includes(requiredPermission(kind, 'course'))
  ) {
    throw accessDenied();
  }
}

function capabilities(actor: CertificateEligibilityActor) {
  return certificateCapabilities({
    canReadEligibility:
      actor.permissions.includes('certificate_eligibility.self_read') ||
      actor.permissions.includes('certificate_eligibility.course_read'),
    canReadCertificateStatus:
      actor.permissions.includes('certificates.self_read') ||
      actor.permissions.includes('certificates.course_read'),
  });
}

function completionEvidence(record: EligibilityEnrollmentRecord): CourseCompletionEvidence {
  const root = record.progressRoot;
  if (!record.completedAt || !root || !root.frozenAt) throw completionEvidenceConflict();
  return {
    enrollmentId: record.id,
    courseId: record.courseId,
    completedAt: record.completedAt,
    completionCurriculumVersion: root.curriculumVersion,
    completionVersion: root.completionVersion,
    completedLessons: root.completedLessons,
    totalEligibleLessons: root.totalEligibleLessons,
    coursePercentage: root.coursePercentage,
    completedEligibleBlocks: root.completedEligibleBlocks,
    totalEligibleBlocks: root.totalEligibleBlocks,
  };
}

export interface CertificateEligibilityUseCases {
  getOwnEligibility(
    enrollmentId: string,
    actor: CertificateEligibilityActor,
  ): Promise<CertificateEligibilityDto>;
  getOwnCertificateStatus(
    enrollmentId: string,
    actor: CertificateEligibilityActor,
  ): Promise<CertificateStatusDto>;
  getCourseEligibility(
    courseId: string,
    enrollmentId: string,
    actor: CertificateEligibilityActor,
    audit: CertificateEligibilityAuditContext,
  ): Promise<CertificateEligibilityDto>;
  getCourseCertificateStatus(
    courseId: string,
    enrollmentId: string,
    actor: CertificateEligibilityActor,
    audit: CertificateEligibilityAuditContext,
  ): Promise<CertificateStatusDto>;
}

export class CertificateEligibilityService implements CertificateEligibilityUseCases {
  constructor(private readonly repository: CertificateEligibilityRepository) {}

  async getOwnEligibility(
    enrollmentId: string,
    actor: CertificateEligibilityActor,
  ): Promise<CertificateEligibilityDto> {
    assertSelfPolicy(actor, 'eligibility');
    const record = await this.repository.findEnrollment(enrollmentId);
    if (!record || record.studentId !== actor.userId) throw enrollmentNotFound();
    return this.eligibility(record, actor);
  }

  async getOwnCertificateStatus(
    enrollmentId: string,
    actor: CertificateEligibilityActor,
  ): Promise<CertificateStatusDto> {
    assertSelfPolicy(actor, 'certificate_status');
    const record = await this.repository.findEnrollment(enrollmentId);
    if (!record || record.studentId !== actor.userId) throw enrollmentNotFound();
    return presentCertificateStatus(record, capabilities(actor), actor, 'self');
  }

  async getCourseEligibility(
    courseId: string,
    enrollmentId: string,
    actor: CertificateEligibilityActor,
    audit: CertificateEligibilityAuditContext,
  ): Promise<CertificateEligibilityDto> {
    const record = await this.loadCourseScoped(courseId, enrollmentId, actor, 'eligibility');
    const result = await this.eligibility(record, actor);
    await this.repository.recordPrivilegedAccess(
      enrollmentId,
      'eligibility',
      record.courseId,
      record.eligibilityEvaluations[0]?.evaluationVersion ?? null,
      audit,
    );
    return result;
  }

  async getCourseCertificateStatus(
    courseId: string,
    enrollmentId: string,
    actor: CertificateEligibilityActor,
    audit: CertificateEligibilityAuditContext,
  ): Promise<CertificateStatusDto> {
    const record = await this.loadCourseScoped(courseId, enrollmentId, actor, 'certificate_status');
    const result = presentCertificateStatus(record, capabilities(actor), actor, 'course');
    await this.repository.recordPrivilegedAccess(
      enrollmentId,
      'certificate_status',
      record.courseId,
      record.eligibilityEvaluations[0]?.evaluationVersion ?? null,
      audit,
    );
    return result;
  }

  private async loadCourseScoped(
    courseId: string,
    enrollmentId: string,
    actor: CertificateEligibilityActor,
    kind: CertificateReadKind,
  ): Promise<EligibilityEnrollmentRecord> {
    assertCoursePolicy(actor, kind);
    const course = await this.repository.findCourse(courseId);
    if (!course) throw courseNotFound();
    if (!actor.roles.includes(RoleCode.ADMIN) && course.teacherId !== actor.userId) {
      throw courseScopeDenied();
    }
    const record = await this.repository.findEnrollment(enrollmentId);
    if (!record || record.courseId !== courseId) throw enrollmentNotFound();
    return record;
  }

  private async eligibility(
    record: EligibilityEnrollmentRecord,
    actor: CertificateEligibilityActor,
  ): Promise<CertificateEligibilityDto> {
    if (record.status !== CourseEnrollmentStatus.COMPLETED) {
      return presentIncompleteEligibility(record, capabilities(actor));
    }
    const evidence = completionEvidence(record);
    if ((await this.repository.countCanonicalCompletionEvents(evidence)) !== 1) {
      throw completionEvidenceConflict();
    }
    return presentCompletedEligibility(record, capabilities(actor));
  }
}
