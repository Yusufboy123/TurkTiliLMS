import {
  CourseEnrollmentSource,
  CourseEnrollmentStatus,
  CourseStatus,
  RoleCode,
} from '@prisma/client';
import type {
  CourseEnrollmentRepository,
  CourseEnrollmentTransactionRepository,
} from '../../src/modules/course-enrollments/course-enrollment.repository.js';
import type {
  CourseEnrollmentRecord,
  CreateEnrollmentData,
  EnrollmentActor,
  EnrollmentAuditContext,
  EnrollmentCourseAccess,
  EnrollmentListQuery,
  EnrollmentStudentSummary,
} from '../../src/modules/course-enrollments/course-enrollment.types.js';

export const ENROLLMENT_ID = '019b9e22-d58e-75bd-9737-eb615a46fb51';
export const COURSE_ID = '019b9e22-d58e-75bd-9737-eb615a46fb52';
export const STUDENT_ID = '019b9e22-d58e-75bd-9737-eb615a46fb53';
export const ADMIN_ID = '019b9e22-d58e-75bd-9737-eb615a46fb54';
export const TEACHER_ID = '019b9e22-d58e-75bd-9737-eb615a46fb55';
export const OTHER_TEACHER_ID = '019b9e22-d58e-75bd-9737-eb615a46fb56';

export const enrollmentAuditContext: EnrollmentAuditContext = { actorUserId: ADMIN_ID };

export const studentActor: EnrollmentActor = {
  userId: STUDENT_ID,
  roles: [RoleCode.STUDENT],
  permissions: ['enrollments.self_create', 'enrollments.self_read', 'enrollments.self_cancel'],
};

export const adminActor: EnrollmentActor = {
  userId: ADMIN_ID,
  roles: [RoleCode.ADMIN],
  permissions: ['enrollments.create', 'enrollments.read', 'enrollments.update_status'],
};

export const teacherActor: EnrollmentActor = {
  userId: TEACHER_ID,
  roles: [RoleCode.TEACHER],
  permissions: ['enrollments.create', 'enrollments.read', 'enrollments.update_status'],
};

export function createEnrollmentCourse(
  overrides: Partial<EnrollmentCourseAccess> = {},
): EnrollmentCourseAccess {
  return {
    id: COURSE_ID,
    title: 'Published course',
    slug: 'published-course',
    status: CourseStatus.PUBLISHED,
    publishedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    teacherId: TEACHER_ID,
    ...overrides,
  };
}

export function createStudent(
  overrides: Partial<EnrollmentStudentSummary> = {},
): EnrollmentStudentSummary {
  return {
    id: STUDENT_ID,
    email: 'student@example.com',
    firstName: 'Ali',
    lastName: 'Talaba',
    displayName: 'Ali Talaba',
    ...overrides,
  };
}

export function createEnrollmentRecord(
  overrides: Partial<CourseEnrollmentRecord> = {},
): CourseEnrollmentRecord {
  return {
    id: ENROLLMENT_ID,
    courseId: COURSE_ID,
    studentId: STUDENT_ID,
    status: CourseEnrollmentStatus.ACTIVE,
    source: CourseEnrollmentSource.SELF,
    enrolledAt: new Date('2026-01-02T00:00:00.000Z'),
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    suspendedAt: null,
    createdById: null,
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    course: {
      id: COURSE_ID,
      title: 'Published course',
      slug: 'published-course',
      teacherId: TEACHER_ID,
    },
    student: createStudent(),
    ...overrides,
  };
}

export class FakeCourseEnrollmentRepository
  implements CourseEnrollmentRepository, CourseEnrollmentTransactionRepository
{
  course: EnrollmentCourseAccess | null = createEnrollmentCourse();
  student: EnrollmentStudentSummary | null = createStudent();
  records: CourseEnrollmentRecord[];
  lastCreateData: CreateEnrollmentData | null = null;
  lastListQuery: EnrollmentListQuery | null = null;
  lastAuditContext: EnrollmentAuditContext | null = null;

  constructor(records: CourseEnrollmentRecord[] = []) {
    this.records = records;
  }

  async withSerializableTransaction<T>(
    operation: (transaction: CourseEnrollmentTransactionRepository) => Promise<T>,
  ): Promise<T> {
    return operation(this);
  }

  lockUser(_userId: string): Promise<void> {
    return Promise.resolve();
  }

  lockCourse(_courseId: string): Promise<void> {
    return Promise.resolve();
  }

  lockStudentEligibility(_studentId: string): Promise<void> {
    return Promise.resolve();
  }

  lockEnrollment(_enrollmentId: string): Promise<void> {
    return Promise.resolve();
  }

  lockCurrentMemberships(_courseId: string, _studentId: string): Promise<void> {
    return Promise.resolve();
  }

  async findCourse(courseId: string): Promise<EnrollmentCourseAccess | null> {
    return this.course?.id === courseId ? this.course : null;
  }

  async findEligibleStudent(studentId: string): Promise<EnrollmentStudentSummary | null> {
    return this.student?.id === studentId ? this.student : null;
  }

  async findById(enrollmentId: string): Promise<CourseEnrollmentRecord | null> {
    return this.records.find((record) => record.id === enrollmentId) ?? null;
  }

  async findLatestForStudentCourse(
    courseId: string,
    studentId: string,
  ): Promise<CourseEnrollmentRecord | null> {
    return (
      [...this.records]
        .reverse()
        .find((record) => record.courseId === courseId && record.studentId === studentId) ?? null
    );
  }

  async findCurrentMembership(
    courseId: string,
    studentId: string,
    excludeEnrollmentId?: string,
  ): Promise<CourseEnrollmentRecord | null> {
    return (
      this.records.find(
        (record) =>
          record.courseId === courseId &&
          record.studentId === studentId &&
          record.id !== excludeEnrollmentId &&
          (
            [
              CourseEnrollmentStatus.ACTIVE,
              CourseEnrollmentStatus.SUSPENDED,
            ] as CourseEnrollmentStatus[]
          ).includes(record.status),
      ) ?? null
    );
  }

  async list(
    query: EnrollmentListQuery,
  ): Promise<{ items: CourseEnrollmentRecord[]; total: number }> {
    this.lastListQuery = query;
    const filtered = this.records.filter(
      (record) =>
        (!query.courseId || record.courseId === query.courseId) &&
        (!query.studentId || record.studentId === query.studentId) &&
        (!query.status || record.status === query.status) &&
        (!query.source || record.source === query.source),
    );
    return { items: filtered.slice(0, query.pageSize), total: filtered.length };
  }

  async createWithAudit(
    data: CreateEnrollmentData,
    context: EnrollmentAuditContext,
  ): Promise<CourseEnrollmentRecord> {
    this.lastCreateData = data;
    this.lastAuditContext = context;
    const record = createEnrollmentRecord({
      id: this.records.length === 0 ? ENROLLMENT_ID : '019b9e22-d58e-75bd-9737-eb615a46fb57',
      courseId: data.courseId,
      studentId: data.studentId,
      source: data.source,
      createdById: data.createdById,
    });
    this.records.push(record);
    return record;
  }

  async updateStatusWithAudit(
    existingRecord: CourseEnrollmentRecord,
    status: CourseEnrollmentStatus,
    context: EnrollmentAuditContext,
  ): Promise<CourseEnrollmentRecord> {
    this.lastAuditContext = context;
    const index = this.records.findIndex((record) => record.id === existingRecord.id);
    const existing = this.records[index];
    if (!existing || existing.status !== existingRecord.status) {
      throw new Error('Fake enrollment state conflict.');
    }
    const now = new Date('2026-02-01T00:00:00.000Z');
    const updated = createEnrollmentRecord({
      ...existing,
      status,
      suspendedAt: status === CourseEnrollmentStatus.SUSPENDED ? now : null,
      cancelledAt: status === CourseEnrollmentStatus.CANCELLED ? now : null,
      completedAt: status === CourseEnrollmentStatus.COMPLETED ? now : null,
    });
    this.records[index] = updated;
    return updated;
  }
}
