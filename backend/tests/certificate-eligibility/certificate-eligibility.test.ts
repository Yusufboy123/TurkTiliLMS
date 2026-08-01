import {
  CertificateEligibilityAssessmentRule,
  CertificateEligibilityEvaluatorType,
  CertificateEligibilityPolicyCode,
  CertificateEligibilityStatus,
  CertificateLifecycleStatus,
  CertificateRevocationReasonCode,
  CourseEnrollmentStatus,
  RoleCode,
} from '@prisma/client';
import type { CertificateEligibilityRepository } from '../../src/modules/certificate-eligibility/certificate-eligibility.repository.js';
import { CertificateEligibilityService } from '../../src/modules/certificate-eligibility/certificate-eligibility.service.js';
import type {
  CertificateEligibilityAuditContext,
  CourseCompletionEvidence,
  EligibilityEnrollmentRecord,
} from '../../src/modules/certificate-eligibility/certificate-eligibility.types.js';

const STUDENT_ID = '019d0000-0000-7000-8000-000000000301';
const TEACHER_ID = '019d0000-0000-7000-8000-000000000302';
const ADMIN_ID = '019d0000-0000-7000-8000-000000000303';
const COURSE_ID = '019d0000-0000-7000-8000-000000000304';
const ENROLLMENT_ID = '019d0000-0000-7000-8000-000000000305';
const COMPLETED_AT = new Date('2026-07-28T10:00:00.000Z');

function enrollment(completed = false): EligibilityEnrollmentRecord {
  const root = {
    completionVersion: completed ? 3 : 1,
    curriculumVersion: 2,
    completedEligibleBlocks: completed ? 4 : 1,
    totalEligibleBlocks: 4,
    completedLessons: completed ? 2 : 0,
    totalEligibleLessons: 2,
    coursePercentage: completed ? 100 : 0,
    frozenAt: completed ? COMPLETED_AT : null,
  };
  return {
    id: ENROLLMENT_ID,
    courseId: COURSE_ID,
    studentId: STUDENT_ID,
    status: completed ? CourseEnrollmentStatus.COMPLETED : CourseEnrollmentStatus.ACTIVE,
    completedAt: completed ? COMPLETED_AT : null,
    course: {
      id: COURSE_ID,
      title: 'Turk tili A1',
      slug: 'turk-tili-a1',
      teacherId: TEACHER_ID,
    },
    progressRoot: root,
    eligibilityEvaluations: completed
      ? [
          {
            id: '019d0000-0000-7000-8000-000000000306',
            enrollmentId: ENROLLMENT_ID,
            courseId: COURSE_ID,
            policyId: '019d0000-0000-7000-8000-000000000307',
            status: CertificateEligibilityStatus.ELIGIBLE,
            evaluationVersion: 1,
            evaluatedAt: new Date('2026-07-28T10:00:01.000Z'),
            completedAt: COMPLETED_AT,
            completionCurriculumVersion: 2,
            completionVersion: 3,
            completedLessons: 2,
            totalEligibleLessons: 2,
            coursePercentage: 100,
            evaluatorType: CertificateEligibilityEvaluatorType.SYSTEM,
            evaluatedByUserId: null,
            policy: {
              id: '019d0000-0000-7000-8000-000000000307',
              code: CertificateEligibilityPolicyCode.COURSE_COMPLETION_ONLY,
              version: 1,
              assessmentRule: CertificateEligibilityAssessmentRule.NONE,
              requiresAttendance: false,
              requiresManualApproval: false,
            },
            reasons: [],
          },
        ]
      : [],
    certificate: null,
  };
}

function certificate(
  status: CertificateLifecycleStatus = CertificateLifecycleStatus.ISSUED,
  hasArtifact = true,
): NonNullable<EligibilityEnrollmentRecord['certificate']> {
  const revoked = status === CertificateLifecycleStatus.REVOKED;
  return {
    id: '019d0000-0000-7000-8000-000000000308',
    certificateNumber: 'TTL-2026-0000000001',
    status,
    version: revoked ? 2 : 1,
    issuedAt: new Date('2026-07-28T10:05:00.000Z'),
    revokedAt: revoked ? new Date('2026-07-29T10:05:00.000Z') : null,
    revocationReasonCode: revoked ? CertificateRevocationReasonCode.ADMINISTRATIVE_ERROR : null,
    artifact: hasArtifact ? { id: '019d0000-0000-7000-8000-000000000309' } : null,
  };
}

class FakeCertificateEligibilityRepository implements CertificateEligibilityRepository {
  record: EligibilityEnrollmentRecord | null = enrollment();
  canonicalEventCount = 1;
  audits: { subjectId: string; view: string }[] = [];

  async findCourse(courseId: string) {
    return courseId === COURSE_ID ? { id: COURSE_ID, teacherId: TEACHER_ID } : null;
  }

  async findEnrollment(enrollmentId: string) {
    return enrollmentId === ENROLLMENT_ID ? this.record : null;
  }

  async countCanonicalCompletionEvents(_evidence: CourseCompletionEvidence) {
    return this.canonicalEventCount;
  }

  async recordPrivilegedAccess(
    subjectId: string,
    view: 'eligibility' | 'certificate_status',
    _courseId: string,
    _evaluationVersion: number | null,
    _context: CertificateEligibilityAuditContext,
  ) {
    this.audits.push({ subjectId, view });
  }
}

function actor(userId: string, roles: RoleCode[], permissions: string[]) {
  return { userId, roles, permissions };
}

describe('CertificateEligibilityService', () => {
  it('derives NOT_COMPLETED without persisting or fabricating evidence', async () => {
    const service = new CertificateEligibilityService(new FakeCertificateEligibilityRepository());
    const result = await service.getOwnEligibility(
      ENROLLMENT_ID,
      actor(STUDENT_ID, [RoleCode.STUDENT], ['certificate_eligibility.self_read']),
    );
    expect(result).toMatchObject({
      completion: { status: 'NOT_COMPLETED', percentage: 0 },
      eligibility: { id: null, status: 'NOT_COMPLETED', reasonCodes: ['COURSE_NOT_COMPLETED'] },
    });
  });

  it('returns canonical completed eligibility and a read-only NOT_ISSUED projection', async () => {
    const repository = new FakeCertificateEligibilityRepository();
    repository.record = enrollment(true);
    const service = new CertificateEligibilityService(repository);
    const self = actor(
      STUDENT_ID,
      [RoleCode.STUDENT],
      ['certificate_eligibility.self_read', 'certificates.self_read'],
    );
    await expect(service.getOwnEligibility(ENROLLMENT_ID, self)).resolves.toMatchObject({
      completion: { status: 'COMPLETED', completionVersion: 3, percentage: 100 },
      eligibility: { status: 'ELIGIBLE', policyCode: 'COURSE_COMPLETION_ONLY' },
      capabilities: { canIssueCertificate: false, canRevokeCertificate: false },
    });
    await expect(service.getOwnCertificateStatus(ENROLLMENT_ID, self)).resolves.toMatchObject({
      status: 'NOT_ISSUED',
      certificate: null,
      capabilities: { canIssueCertificate: false, canRevokeCertificate: false },
    });
  });

  it('projects safe ISSUED and REVOKED certificate summaries with self download policy', async () => {
    const repository = new FakeCertificateEligibilityRepository();
    repository.record = { ...enrollment(true), certificate: certificate() };
    const service = new CertificateEligibilityService(repository);
    const self = actor(
      STUDENT_ID,
      [RoleCode.STUDENT],
      ['certificates.self_read', 'certificates.self_download'],
    );

    const issued = await service.getOwnCertificateStatus(ENROLLMENT_ID, self);
    expect(issued).toEqual({
      enrollmentId: ENROLLMENT_ID,
      course: { id: COURSE_ID, title: 'Turk tili A1', slug: 'turk-tili-a1' },
      status: 'ISSUED',
      certificate: {
        id: '019d0000-0000-7000-8000-000000000308',
        certificateId: '019d0000-0000-7000-8000-000000000308',
        certificateNumber: 'TTL-2026-0000000001',
        status: 'ISSUED',
        issuedAt: '2026-07-28T10:05:00.000Z',
        revokedAt: null,
        safeRevocationReasonCode: null,
        version: 1,
        canDownload: true,
      },
      capabilities: {
        canReadEligibility: false,
        canReadCertificateStatus: true,
        canIssueCertificate: false,
        canRevokeCertificate: false,
      },
    });
    expect(JSON.stringify(issued)).not.toMatch(
      /verificationToken|storageKey|artifactId|renderer|revocationReasonNote|stepUp/iu,
    );

    repository.record = {
      ...enrollment(true),
      certificate: certificate(CertificateLifecycleStatus.REVOKED),
    };
    await expect(service.getOwnCertificateStatus(ENROLLMENT_ID, self)).resolves.toMatchObject({
      status: 'REVOKED',
      certificate: {
        status: 'REVOKED',
        revokedAt: '2026-07-29T10:05:00.000Z',
        safeRevocationReasonCode: 'ADMINISTRATIVE_ERROR',
        canDownload: false,
      },
    });
  });

  it('keeps teacher download disabled and grants course download only to permitted admins', async () => {
    const repository = new FakeCertificateEligibilityRepository();
    repository.record = { ...enrollment(true), certificate: certificate() };
    const service = new CertificateEligibilityService(repository);

    const teacher = await service.getCourseCertificateStatus(
      COURSE_ID,
      ENROLLMENT_ID,
      actor(TEACHER_ID, [RoleCode.TEACHER], ['certificates.course_read', 'certificates.download']),
      { actorUserId: TEACHER_ID },
    );
    expect(teacher.certificate?.canDownload).toBe(false);

    const admin = await service.getCourseCertificateStatus(
      COURSE_ID,
      ENROLLMENT_ID,
      actor(ADMIN_ID, [RoleCode.ADMIN], ['certificates.course_read', 'certificates.download']),
      { actorUserId: ADMIN_ID },
    );
    expect(admin.certificate?.canDownload).toBe(true);

    const adminWithoutDownloadPermission = await service.getCourseCertificateStatus(
      COURSE_ID,
      ENROLLMENT_ID,
      actor(ADMIN_ID, [RoleCode.ADMIN], ['certificates.course_read']),
      { actorUserId: ADMIN_ID },
    );
    expect(adminWithoutDownloadPermission.certificate?.canDownload).toBe(false);

    repository.record = {
      ...enrollment(true),
      certificate: certificate(CertificateLifecycleStatus.ISSUED, false),
    };
    const withoutArtifact = await service.getCourseCertificateStatus(
      COURSE_ID,
      ENROLLMENT_ID,
      actor(ADMIN_ID, [RoleCode.ADMIN], ['certificates.course_read', 'certificates.download']),
      { actorUserId: ADMIN_ID },
    );
    expect(withoutArtifact.certificate?.canDownload).toBe(false);
  });

  it('rejects missing or contradictory canonical evidence instead of repairing on read', async () => {
    const repository = new FakeCertificateEligibilityRepository();
    repository.record = enrollment(true);
    repository.canonicalEventCount = 0;
    const service = new CertificateEligibilityService(repository);
    await expect(
      service.getOwnEligibility(
        ENROLLMENT_ID,
        actor(STUDENT_ID, [RoleCode.STUDENT], ['certificate_eligibility.self_read']),
      ),
    ).rejects.toMatchObject({ statusCode: 409, code: 'COMPLETION_EVIDENCE_CONFLICT' });

    repository.canonicalEventCount = 1;
    repository.record!.eligibilityEvaluations = [];
    await expect(
      service.getOwnEligibility(
        ENROLLMENT_ID,
        actor(STUDENT_ID, [RoleCode.STUDENT], ['certificate_eligibility.self_read']),
      ),
    ).rejects.toMatchObject({ statusCode: 409, code: 'COMPLETION_EVIDENCE_CONFLICT' });

    repository.record = enrollment(true);
    repository.record.progressRoot!.frozenAt = new Date('2026-07-28T09:59:59.000Z');
    await expect(
      service.getOwnEligibility(
        ENROLLMENT_ID,
        actor(STUDENT_ID, [RoleCode.STUDENT], ['certificate_eligibility.self_read']),
      ),
    ).rejects.toMatchObject({ statusCode: 409, code: 'COMPLETION_EVIDENCE_CONFLICT' });
  });

  it('enforces self ownership, role, and permission in direct service calls', async () => {
    const service = new CertificateEligibilityService(new FakeCertificateEligibilityRepository());
    await expect(
      service.getOwnEligibility(
        ENROLLMENT_ID,
        actor(ADMIN_ID, [RoleCode.ADMIN], ['certificate_eligibility.self_read']),
      ),
    ).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
    await expect(
      service.getOwnEligibility(
        ENROLLMENT_ID,
        actor(ADMIN_ID, [RoleCode.STUDENT], ['certificate_eligibility.self_read']),
      ),
    ).rejects.toMatchObject({ code: 'ENROLLMENT_NOT_FOUND' });
    await expect(
      service.getOwnCertificateStatus(
        ENROLLMENT_ID,
        actor(ADMIN_ID, [RoleCode.STUDENT], ['certificates.self_read']),
      ),
    ).rejects.toMatchObject({ code: 'ENROLLMENT_NOT_FOUND' });
  });

  it('enforces teacher ownership and audits every privileged read', async () => {
    const repository = new FakeCertificateEligibilityRepository();
    const service = new CertificateEligibilityService(repository);
    const teacher = actor(
      TEACHER_ID,
      [RoleCode.TEACHER],
      ['certificate_eligibility.course_read', 'certificates.course_read'],
    );
    await service.getCourseEligibility(COURSE_ID, ENROLLMENT_ID, teacher, {
      actorUserId: TEACHER_ID,
    });
    await service.getCourseCertificateStatus(COURSE_ID, ENROLLMENT_ID, teacher, {
      actorUserId: TEACHER_ID,
    });
    expect(repository.audits).toEqual([
      { subjectId: ENROLLMENT_ID, view: 'eligibility' },
      { subjectId: ENROLLMENT_ID, view: 'certificate_status' },
    ]);

    await expect(
      service.getCourseEligibility(
        COURSE_ID,
        ENROLLMENT_ID,
        actor(ADMIN_ID, [RoleCode.TEACHER], ['certificate_eligibility.course_read']),
        { actorUserId: ADMIN_ID },
      ),
    ).rejects.toMatchObject({ code: 'COURSE_SCOPE_DENIED' });
  });
});
