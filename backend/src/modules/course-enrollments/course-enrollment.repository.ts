import {
  CourseEnrollmentStatus,
  Prisma,
  RoleCode,
  UserStatus,
  type PrismaClient,
} from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type {
  CourseEnrollmentRecord,
  CreateEnrollmentData,
  EnrollmentAuditContext,
  EnrollmentCourseAccess,
  EnrollmentListQuery,
  EnrollmentStudentSummary,
} from './course-enrollment.types.js';

const MAX_TRANSACTION_ATTEMPTS = 3;
export const CURRENT_MEMBERSHIP_UNIQUE_INDEX =
  'course_enrollments_current_course_id_student_id_key';

const enrollmentSelect = {
  id: true,
  courseId: true,
  studentId: true,
  status: true,
  source: true,
  enrolledAt: true,
  startedAt: true,
  completedAt: true,
  cancelledAt: true,
  suspendedAt: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  course: {
    select: {
      id: true,
      title: true,
      slug: true,
      teacherId: true,
    },
  },
  student: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      displayName: true,
    },
  },
} satisfies Prisma.CourseEnrollmentSelect;

type EnrollmentPayload = Prisma.CourseEnrollmentGetPayload<{ select: typeof enrollmentSelect }>;

function mapEnrollment(enrollment: EnrollmentPayload): CourseEnrollmentRecord {
  return enrollment;
}

function auditFields(context: EnrollmentAuditContext) {
  return {
    actorUserId: context.actorUserId,
    ...(context.requestCorrelationId ? { requestCorrelationId: context.requestCorrelationId } : {}),
    ...(context.ipHash ? { ipHash: context.ipHash } : {}),
    ...(context.userAgentSummary ? { userAgentSummary: context.userAgentSummary } : {}),
  };
}

function auditSummary(enrollment: EnrollmentPayload): Prisma.InputJsonObject {
  return {
    courseId: enrollment.courseId,
    studentId: enrollment.studentId,
    status: enrollment.status,
    source: enrollment.source,
    enrolledAt: enrollment.enrolledAt.toISOString(),
    startedAt: enrollment.startedAt?.toISOString() ?? null,
    completedAt: enrollment.completedAt?.toISOString() ?? null,
    cancelledAt: enrollment.cancelledAt?.toISOString() ?? null,
    suspendedAt: enrollment.suspendedAt?.toISOString() ?? null,
    createdById: enrollment.createdById,
  };
}

function isSerializationConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === 'P2034') return true;

  // Prisma reports a PostgreSQL 40001 raised by a parameterized raw row-lock
  // query as P2010. It is the same genuine serialization failure and is safe
  // to retry within the existing bounded transaction retry policy.
  return error.code === 'P2010' && error.meta?.code === '40001';
}

export function isCurrentMembershipUniqueError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }

  const target = error.meta?.target;
  return (
    target === CURRENT_MEMBERSHIP_UNIQUE_INDEX ||
    (Array.isArray(target) && target.includes(CURRENT_MEMBERSHIP_UNIQUE_INDEX))
  );
}

function isEnrollmentReferenceError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2003') {
    return false;
  }

  const constraint = error.meta?.constraint;
  return (
    error.meta?.modelName === 'CourseEnrollment' ||
    (typeof constraint === 'string' &&
      [
        'course_enrollments_course_id_fkey',
        'course_enrollments_student_id_fkey',
        'course_enrollments_created_by_id_fkey',
      ].includes(constraint))
  );
}

function enrollmentWhere(query: EnrollmentListQuery): Prisma.CourseEnrollmentWhereInput {
  const where: Prisma.CourseEnrollmentWhereInput = {};

  if (query.status) where.status = query.status;
  if (query.source) where.source = query.source;
  if (query.studentId) where.studentId = query.studentId;
  if (query.courseId) where.courseId = query.courseId;
  if (query.enrolledFrom || query.enrolledTo) {
    where.enrolledAt = {
      ...(query.enrolledFrom ? { gte: query.enrolledFrom } : {}),
      ...(query.enrolledTo ? { lte: query.enrolledTo } : {}),
    };
  }
  if (query.search) {
    where.student = {
      OR: [
        { email: { contains: query.search, mode: 'insensitive' } },
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { displayName: { contains: query.search, mode: 'insensitive' } },
      ],
    };
  }

  return where;
}

export class EnrollmentAlreadyExistsError extends Error {}
export class EnrollmentReferenceConflictError extends Error {}
export class EnrollmentStateConflictError extends Error {}
export class EnrollmentTransactionConflictError extends Error {}

export interface CourseEnrollmentTransactionRepository {
  lockUser(userId: string): Promise<void>;
  lockCourse(courseId: string): Promise<void>;
  lockStudentEligibility(studentId: string): Promise<void>;
  lockEnrollment(enrollmentId: string): Promise<void>;
  lockCurrentMemberships(courseId: string, studentId: string): Promise<void>;
  findCourse(courseId: string): Promise<EnrollmentCourseAccess | null>;
  findEligibleStudent(studentId: string): Promise<EnrollmentStudentSummary | null>;
  findById(enrollmentId: string): Promise<CourseEnrollmentRecord | null>;
  findLatestForStudentCourse(
    courseId: string,
    studentId: string,
  ): Promise<CourseEnrollmentRecord | null>;
  findCurrentMembership(
    courseId: string,
    studentId: string,
    excludeEnrollmentId?: string,
  ): Promise<CourseEnrollmentRecord | null>;
  createWithAudit(
    data: CreateEnrollmentData,
    context: EnrollmentAuditContext,
  ): Promise<CourseEnrollmentRecord>;
  updateStatusWithAudit(
    existing: CourseEnrollmentRecord,
    status: CourseEnrollmentStatus,
    context: EnrollmentAuditContext,
  ): Promise<CourseEnrollmentRecord>;
}

export interface CourseEnrollmentRepository {
  withSerializableTransaction<T>(
    operation: (transaction: CourseEnrollmentTransactionRepository) => Promise<T>,
  ): Promise<T>;
  findCourse(courseId: string): Promise<EnrollmentCourseAccess | null>;
  findById(enrollmentId: string): Promise<CourseEnrollmentRecord | null>;
  list(query: EnrollmentListQuery): Promise<{ items: CourseEnrollmentRecord[]; total: number }>;
}

class PrismaCourseEnrollmentTransactionRepository implements CourseEnrollmentTransactionRepository {
  constructor(private readonly transaction: Prisma.TransactionClient) {}

  async lockUser(userId: string): Promise<void> {
    await this.transaction.$queryRaw`
      SELECT "id"
      FROM "users"
      WHERE "id" = ${userId}::uuid
      FOR SHARE
    `;
  }

  async lockCourse(courseId: string): Promise<void> {
    // A shared row lock makes concurrent publication, teacher-assignment, soft-delete,
    // or hard-delete changes serialize with the enrollment decision.
    await this.transaction.$queryRaw`
      SELECT "id"
      FROM "courses"
      WHERE "id" = ${courseId}::uuid
      FOR SHARE
    `;
  }

  async lockStudentEligibility(studentId: string): Promise<void> {
    // Lock both the account and its STUDENT assignment. PostgreSQL will force a
    // serializable retry if either eligibility input changes during this decision.
    await this.lockUser(studentId);
    await this.transaction.$queryRaw`
      SELECT ur."user_id"
      FROM "user_roles" AS ur
      INNER JOIN "roles" AS r ON r."id" = ur."role_id"
      WHERE ur."user_id" = ${studentId}::uuid
        AND r."code" = 'STUDENT'::"role_code"
      FOR SHARE OF ur, r
    `;
  }

  async lockEnrollment(enrollmentId: string): Promise<void> {
    await this.transaction.$queryRaw`
      SELECT "id"
      FROM "course_enrollments"
      WHERE "id" = ${enrollmentId}::uuid
      FOR UPDATE
    `;
  }

  async lockCurrentMemberships(courseId: string, studentId: string): Promise<void> {
    await this.transaction.$queryRaw`
      SELECT "id"
      FROM "course_enrollments"
      WHERE "course_id" = ${courseId}::uuid
        AND "student_id" = ${studentId}::uuid
        AND "status" IN (
          'ACTIVE'::"course_enrollment_status",
          'SUSPENDED'::"course_enrollment_status"
        )
      FOR UPDATE
    `;
  }

  async findCourse(courseId: string): Promise<EnrollmentCourseAccess | null> {
    return findCourse(this.transaction, courseId);
  }

  async findEligibleStudent(studentId: string): Promise<EnrollmentStudentSummary | null> {
    return findEligibleStudent(this.transaction, studentId);
  }

  async findById(enrollmentId: string): Promise<CourseEnrollmentRecord | null> {
    return findEnrollment(this.transaction, enrollmentId);
  }

  async findLatestForStudentCourse(
    courseId: string,
    studentId: string,
  ): Promise<CourseEnrollmentRecord | null> {
    const enrollment = await this.transaction.courseEnrollment.findFirst({
      where: { courseId, studentId },
      select: enrollmentSelect,
      orderBy: [{ enrolledAt: 'desc' }, { id: 'desc' }],
    });
    return enrollment ? mapEnrollment(enrollment) : null;
  }

  async findCurrentMembership(
    courseId: string,
    studentId: string,
    excludeEnrollmentId?: string,
  ): Promise<CourseEnrollmentRecord | null> {
    const enrollment = await this.transaction.courseEnrollment.findFirst({
      where: {
        courseId,
        studentId,
        status: { in: [CourseEnrollmentStatus.ACTIVE, CourseEnrollmentStatus.SUSPENDED] },
        ...(excludeEnrollmentId ? { id: { not: excludeEnrollmentId } } : {}),
      },
      select: enrollmentSelect,
    });
    return enrollment ? mapEnrollment(enrollment) : null;
  }

  async createWithAudit(
    data: CreateEnrollmentData,
    context: EnrollmentAuditContext,
  ): Promise<CourseEnrollmentRecord> {
    const enrollment = await this.transaction.courseEnrollment.create({
      data,
      select: enrollmentSelect,
    });
    await this.transaction.auditLog.create({
      data: {
        ...auditFields(context),
        action: 'course_enrollments.created',
        subjectType: 'course_enrollment',
        subjectId: enrollment.id,
        afterSummary: auditSummary(enrollment),
      },
    });
    return mapEnrollment(enrollment);
  }

  async updateStatusWithAudit(
    existing: CourseEnrollmentRecord,
    status: CourseEnrollmentStatus,
    context: EnrollmentAuditContext,
  ): Promise<CourseEnrollmentRecord> {
    const now = new Date();
    const lifecycleDates =
      status === CourseEnrollmentStatus.ACTIVE
        ? { suspendedAt: null, cancelledAt: null, completedAt: null }
        : status === CourseEnrollmentStatus.SUSPENDED
          ? { suspendedAt: now, cancelledAt: null, completedAt: null }
          : status === CourseEnrollmentStatus.CANCELLED
            ? { cancelledAt: now, suspendedAt: null, completedAt: null }
            : { completedAt: now, suspendedAt: null, cancelledAt: null };
    const update = await this.transaction.courseEnrollment.updateMany({
      where: { id: existing.id, status: existing.status },
      data: { status, ...lifecycleDates },
    });
    if (update.count !== 1) throw new EnrollmentStateConflictError();

    const updated = await findEnrollment(this.transaction, existing.id);
    if (!updated) throw new EnrollmentStateConflictError();
    await this.transaction.auditLog.create({
      data: {
        ...auditFields(context),
        action: `course_enrollments.${status.toLowerCase()}`,
        subjectType: 'course_enrollment',
        subjectId: existing.id,
        beforeSummary: auditSummary(existing as EnrollmentPayload),
        afterSummary: auditSummary(updated as EnrollmentPayload),
      },
    });
    return updated;
  }
}

type EnrollmentReadClient = Pick<
  PrismaClient | Prisma.TransactionClient,
  'course' | 'user' | 'courseEnrollment'
>;

async function findCourse(
  client: EnrollmentReadClient,
  courseId: string,
): Promise<EnrollmentCourseAccess | null> {
  return client.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      publishedAt: true,
      deletedAt: true,
      teacherId: true,
    },
  });
}

async function findEligibleStudent(
  client: EnrollmentReadClient,
  studentId: string,
): Promise<EnrollmentStudentSummary | null> {
  const now = new Date();
  return client.user.findFirst({
    where: {
      id: studentId,
      status: UserStatus.ACTIVE,
      deletedAt: null,
      roles: {
        some: {
          role: { code: RoleCode.STUDENT },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      },
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      displayName: true,
    },
  });
}

async function findEnrollment(
  client: EnrollmentReadClient,
  enrollmentId: string,
): Promise<CourseEnrollmentRecord | null> {
  const enrollment = await client.courseEnrollment.findUnique({
    where: { id: enrollmentId },
    select: enrollmentSelect,
  });
  return enrollment ? mapEnrollment(enrollment) : null;
}

export class PrismaCourseEnrollmentRepository implements CourseEnrollmentRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async withSerializableTransaction<T>(
    operation: (transaction: CourseEnrollmentTransactionRepository) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        return await this.client.$transaction(
          (transaction) => operation(new PrismaCourseEnrollmentTransactionRepository(transaction)),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error: unknown) {
        if (isCurrentMembershipUniqueError(error)) {
          throw new EnrollmentAlreadyExistsError();
        }
        if (isEnrollmentReferenceError(error)) {
          throw new EnrollmentReferenceConflictError();
        }
        if (!isSerializationConflict(error)) {
          throw error;
        }
        if (attempt === MAX_TRANSACTION_ATTEMPTS) {
          throw new EnrollmentTransactionConflictError();
        }
      }
    }

    throw new Error('Serializable enrollment transaction attempts exhausted.');
  }

  async findCourse(courseId: string): Promise<EnrollmentCourseAccess | null> {
    return findCourse(this.client, courseId);
  }

  async findById(enrollmentId: string): Promise<CourseEnrollmentRecord | null> {
    return findEnrollment(this.client, enrollmentId);
  }

  async list(
    query: EnrollmentListQuery,
  ): Promise<{ items: CourseEnrollmentRecord[]; total: number }> {
    const where = enrollmentWhere(query);
    const [enrollments, total] = await this.client.$transaction([
      this.client.courseEnrollment.findMany({
        where,
        select: enrollmentSelect,
        orderBy: [{ [query.sortBy]: query.sortDirection }, { id: query.sortDirection }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.client.courseEnrollment.count({ where }),
    ]);
    return { items: enrollments.map(mapEnrollment), total };
  }
}
