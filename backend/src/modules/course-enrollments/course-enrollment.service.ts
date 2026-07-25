import {
  CourseEnrollmentSource,
  CourseEnrollmentStatus,
  CourseStatus,
  RoleCode,
} from '@prisma/client';
import { AppError } from '../../utils/app-error.js';
import {
  EnrollmentAlreadyExistsError,
  EnrollmentReferenceConflictError,
  EnrollmentStateConflictError,
  EnrollmentTransactionConflictError,
  type CourseEnrollmentRepository,
  type CourseEnrollmentTransactionRepository,
} from './course-enrollment.repository.js';
import type {
  CourseEnrollmentRecord,
  EnrollmentActor,
  EnrollmentAuditContext,
  EnrollmentCourseAccess,
  EnrollmentListQuery,
  PaginatedEnrollments,
} from './course-enrollment.types.js';

const allowedTransitions: Record<CourseEnrollmentStatus, CourseEnrollmentStatus[]> = {
  ACTIVE: [
    CourseEnrollmentStatus.CANCELLED,
    CourseEnrollmentStatus.SUSPENDED,
    CourseEnrollmentStatus.COMPLETED,
  ],
  SUSPENDED: [CourseEnrollmentStatus.ACTIVE, CourseEnrollmentStatus.CANCELLED],
  CANCELLED: [],
  COMPLETED: [],
};

function enrollmentNotFound(): AppError {
  return new AppError('Enrollment topilmadi.', 404, 'ENROLLMENT_NOT_FOUND');
}

function isAdministrator(actor: EnrollmentActor): boolean {
  return actor.roles.includes(RoleCode.ADMIN);
}

function assertRole(actor: EnrollmentActor, ...roles: RoleCode[]): void {
  if (!roles.some((role) => actor.roles.includes(role))) {
    throw new AppError('Bu amal uchun ruxsat yetarli emas.', 403, 'ACCESS_DENIED');
  }
}

function assertPermission(actor: EnrollmentActor, permission: string): void {
  if (!actor.permissions.includes(permission)) {
    throw new AppError('Bu amal uchun ruxsat yetarli emas.', 403, 'ACCESS_DENIED');
  }
}

function assertSelfPolicy(actor: EnrollmentActor, permission: string): void {
  assertRole(actor, RoleCode.STUDENT);
  assertPermission(actor, permission);
}

function assertManagementPolicy(actor: EnrollmentActor, permission: string): void {
  assertRole(actor, RoleCode.ADMIN, RoleCode.TEACHER);
  assertPermission(actor, permission);
}

function assertCourseScope(actor: EnrollmentActor, course: { teacherId: string | null }): void {
  if (!isAdministrator(actor) && course.teacherId !== actor.userId) {
    throw new AppError('Bu kurs sizga biriktirilmagan.', 403, 'COURSE_SCOPE_DENIED');
  }
}

function assertCourseEnrollable(course: EnrollmentCourseAccess | null): asserts course {
  if (!course) {
    throw new AppError('Kurs topilmadi.', 404, 'COURSE_NOT_FOUND');
  }
  if (course.deletedAt || course.status !== CourseStatus.PUBLISHED || course.publishedAt === null) {
    throw new AppError(
      'Bu kursga hozir enrollment qilish mumkin emas.',
      409,
      'COURSE_NOT_ENROLLABLE',
    );
  }
}

function assertValidTransition(
  currentStatus: CourseEnrollmentStatus,
  targetStatus: CourseEnrollmentStatus,
): void {
  if (!allowedTransitions[currentStatus].includes(targetStatus)) {
    throw new AppError(
      `${currentStatus} holatidan ${targetStatus} holatiga o‘tish mumkin emas.`,
      409,
      'INVALID_ENROLLMENT_STATUS_TRANSITION',
    );
  }
}

function toPagination(
  items: CourseEnrollmentRecord[],
  total: number,
  query: EnrollmentListQuery,
): PaginatedEnrollments {
  return {
    items,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems: total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  };
}

function trustedAuditContext(
  actor: EnrollmentActor,
  context: EnrollmentAuditContext,
): EnrollmentAuditContext {
  return { ...context, actorUserId: actor.userId };
}

function mapRepositoryConflict(error: unknown): never {
  if (error instanceof EnrollmentAlreadyExistsError) {
    throw new AppError('Talaba bu kursga allaqachon enrollment qilingan.', 409, 'ALREADY_ENROLLED');
  }
  if (error instanceof EnrollmentReferenceConflictError) {
    throw new AppError(
      'Enrollmentga bog‘liq ma’lumot parallel so‘rovda o‘zgardi.',
      409,
      'ENROLLMENT_REFERENCE_CONFLICT',
    );
  }
  if (
    error instanceof EnrollmentStateConflictError ||
    error instanceof EnrollmentTransactionConflictError
  ) {
    throw new AppError(
      'Enrollment holati parallel so‘rov sabab o‘zgardi. Qayta urinib ko‘ring.',
      409,
      'ENROLLMENT_CONFLICT',
    );
  }
  throw error;
}

export interface CourseEnrollmentUseCases {
  selfEnroll(
    courseId: string,
    actor: EnrollmentActor,
    context: EnrollmentAuditContext,
  ): Promise<CourseEnrollmentRecord>;
  createManaged(
    courseId: string,
    studentId: string,
    actor: EnrollmentActor,
    context: EnrollmentAuditContext,
  ): Promise<CourseEnrollmentRecord>;
  listOwn(query: EnrollmentListQuery, actor: EnrollmentActor): Promise<PaginatedEnrollments>;
  getOwn(enrollmentId: string, actor: EnrollmentActor): Promise<CourseEnrollmentRecord>;
  cancelOwn(
    enrollmentId: string,
    actor: EnrollmentActor,
    context: EnrollmentAuditContext,
  ): Promise<CourseEnrollmentRecord>;
  listCourse(
    courseId: string,
    query: EnrollmentListQuery,
    actor: EnrollmentActor,
  ): Promise<PaginatedEnrollments>;
  getManaged(enrollmentId: string, actor: EnrollmentActor): Promise<CourseEnrollmentRecord>;
  updateStatus(
    enrollmentId: string,
    status: CourseEnrollmentStatus,
    actor: EnrollmentActor,
    context: EnrollmentAuditContext,
  ): Promise<CourseEnrollmentRecord>;
}

export class CourseEnrollmentService implements CourseEnrollmentUseCases {
  constructor(private readonly repository: CourseEnrollmentRepository) {}

  async selfEnroll(
    courseId: string,
    actor: EnrollmentActor,
    context: EnrollmentAuditContext,
  ): Promise<CourseEnrollmentRecord> {
    assertSelfPolicy(actor, 'enrollments.self_create');
    return this.createEnrollment(
      courseId,
      actor.userId,
      CourseEnrollmentSource.SELF,
      actor,
      context,
    );
  }

  async createManaged(
    courseId: string,
    studentId: string,
    actor: EnrollmentActor,
    context: EnrollmentAuditContext,
  ): Promise<CourseEnrollmentRecord> {
    assertManagementPolicy(actor, 'enrollments.create');
    return this.createEnrollment(courseId, studentId, CourseEnrollmentSource.ADMIN, actor, context);
  }

  async listOwn(query: EnrollmentListQuery, actor: EnrollmentActor): Promise<PaginatedEnrollments> {
    assertSelfPolicy(actor, 'enrollments.self_read');
    const scopedQuery = { ...query, studentId: actor.userId };
    const result = await this.repository.list(scopedQuery);
    return toPagination(result.items, result.total, scopedQuery);
  }

  async getOwn(enrollmentId: string, actor: EnrollmentActor): Promise<CourseEnrollmentRecord> {
    assertSelfPolicy(actor, 'enrollments.self_read');
    const enrollment = await this.repository.findById(enrollmentId);
    if (!enrollment || enrollment.studentId !== actor.userId) throw enrollmentNotFound();
    return enrollment;
  }

  async cancelOwn(
    enrollmentId: string,
    actor: EnrollmentActor,
    context: EnrollmentAuditContext,
  ): Promise<CourseEnrollmentRecord> {
    assertSelfPolicy(actor, 'enrollments.self_cancel');
    try {
      return await this.repository.withSerializableTransaction(async (transaction) => {
        await transaction.lockEnrollment(enrollmentId);
        const enrollment = await transaction.findById(enrollmentId);
        if (!enrollment || enrollment.studentId !== actor.userId) throw enrollmentNotFound();
        if (enrollment.status !== CourseEnrollmentStatus.ACTIVE) {
          throw new AppError(
            'Faqat faol enrollmentni bekor qilish mumkin.',
            409,
            'ENROLLMENT_NOT_CANCELLABLE',
          );
        }
        return transaction.updateStatusWithAudit(
          enrollment,
          CourseEnrollmentStatus.CANCELLED,
          trustedAuditContext(actor, context),
        );
      });
    } catch (error: unknown) {
      return mapRepositoryConflict(error);
    }
  }

  async listCourse(
    courseId: string,
    query: EnrollmentListQuery,
    actor: EnrollmentActor,
  ): Promise<PaginatedEnrollments> {
    assertManagementPolicy(actor, 'enrollments.read');
    const course = await this.repository.findCourse(courseId);
    if (!course) throw new AppError('Kurs topilmadi.', 404, 'COURSE_NOT_FOUND');
    assertCourseScope(actor, course);
    const scopedQuery = { ...query, courseId };
    const result = await this.repository.list(scopedQuery);
    return toPagination(result.items, result.total, scopedQuery);
  }

  async getManaged(enrollmentId: string, actor: EnrollmentActor): Promise<CourseEnrollmentRecord> {
    assertManagementPolicy(actor, 'enrollments.read');
    const enrollment = await this.repository.findById(enrollmentId);
    if (!enrollment) throw enrollmentNotFound();
    assertCourseScope(actor, enrollment.course);
    return enrollment;
  }

  async updateStatus(
    enrollmentId: string,
    status: CourseEnrollmentStatus,
    actor: EnrollmentActor,
    context: EnrollmentAuditContext,
  ): Promise<CourseEnrollmentRecord> {
    assertManagementPolicy(actor, 'enrollments.update_status');
    try {
      return await this.repository.withSerializableTransaction(async (transaction) => {
        await transaction.lockEnrollment(enrollmentId);
        const enrollment = await transaction.findById(enrollmentId);
        if (!enrollment) throw enrollmentNotFound();

        await transaction.lockCourse(enrollment.courseId);
        const course = await transaction.findCourse(enrollment.courseId);
        if (!course) throw new AppError('Kurs topilmadi.', 404, 'COURSE_NOT_FOUND');
        assertCourseScope(actor, course);
        assertValidTransition(enrollment.status, status);

        if (status === CourseEnrollmentStatus.ACTIVE) {
          await this.assertReactivationEligibility(transaction, enrollment, actor);
        }

        return transaction.updateStatusWithAudit(
          enrollment,
          status,
          trustedAuditContext(actor, context),
        );
      });
    } catch (error: unknown) {
      return mapRepositoryConflict(error);
    }
  }

  private async createEnrollment(
    courseId: string,
    studentId: string,
    source: CourseEnrollmentSource,
    actor: EnrollmentActor,
    context: EnrollmentAuditContext,
  ): Promise<CourseEnrollmentRecord> {
    try {
      return await this.repository.withSerializableTransaction(async (transaction) => {
        if (source === CourseEnrollmentSource.ADMIN) {
          await transaction.lockUser(actor.userId);
        }
        await transaction.lockCourse(courseId);
        const course = await transaction.findCourse(courseId);
        assertCourseEnrollable(course);
        if (source === CourseEnrollmentSource.ADMIN) assertCourseScope(actor, course);

        await transaction.lockStudentEligibility(studentId);
        const student = await transaction.findEligibleStudent(studentId);
        if (!student) {
          throw new AppError(
            'Faol STUDENT roliga ega talaba topilmadi.',
            422,
            'STUDENT_NOT_ELIGIBLE',
          );
        }

        await transaction.lockCurrentMemberships(courseId, studentId);
        const latest = await transaction.findLatestForStudentCourse(courseId, studentId);
        if (latest?.status === CourseEnrollmentStatus.ACTIVE) {
          throw new AppError(
            'Talaba bu kursga allaqachon enrollment qilingan.',
            409,
            'ALREADY_ENROLLED',
          );
        }
        if (latest?.status === CourseEnrollmentStatus.SUSPENDED) {
          throw new AppError(
            'Enrollment to‘xtatilgan; uni status amali orqali faollashtiring.',
            409,
            'ENROLLMENT_SUSPENDED',
          );
        }
        if (latest?.status === CourseEnrollmentStatus.COMPLETED) {
          throw new AppError('Talaba bu kursni yakunlagan.', 409, 'ENROLLMENT_COMPLETED');
        }

        return transaction.createWithAudit(
          {
            courseId,
            studentId,
            source,
            createdById: source === CourseEnrollmentSource.ADMIN ? actor.userId : null,
          },
          trustedAuditContext(actor, context),
        );
      });
    } catch (error: unknown) {
      return mapRepositoryConflict(error);
    }
  }

  private async assertReactivationEligibility(
    transaction: CourseEnrollmentTransactionRepository,
    enrollment: CourseEnrollmentRecord,
    actor: EnrollmentActor,
  ): Promise<void> {
    const course = await transaction.findCourse(enrollment.courseId);
    assertCourseEnrollable(course);
    assertCourseScope(actor, course);

    await transaction.lockStudentEligibility(enrollment.studentId);
    const student = await transaction.findEligibleStudent(enrollment.studentId);
    if (!student) {
      throw new AppError('Faol STUDENT roliga ega talaba topilmadi.', 422, 'STUDENT_NOT_ELIGIBLE');
    }

    await transaction.lockCurrentMemberships(enrollment.courseId, enrollment.studentId);
    const conflict = await transaction.findCurrentMembership(
      enrollment.courseId,
      enrollment.studentId,
      enrollment.id,
    );
    if (conflict) {
      throw new AppError(
        'Talaba bu kursga allaqachon enrollment qilingan.',
        409,
        'ALREADY_ENROLLED',
      );
    }
  }
}
