import type {
  CourseEnrollmentRecord,
  ManagedEnrollmentResponse,
  PaginatedEnrollmentResponse,
  PaginatedEnrollments,
  SelfEnrollmentResponse,
} from './course-enrollment.types.js';

export function presentSelfEnrollment(enrollment: CourseEnrollmentRecord): SelfEnrollmentResponse {
  return {
    id: enrollment.id,
    courseId: enrollment.courseId,
    studentId: enrollment.studentId,
    status: enrollment.status,
    source: enrollment.source,
    enrolledAt: enrollment.enrolledAt,
    startedAt: enrollment.startedAt,
    completedAt: enrollment.completedAt,
    cancelledAt: enrollment.cancelledAt,
    suspendedAt: enrollment.suspendedAt,
    createdAt: enrollment.createdAt,
    updatedAt: enrollment.updatedAt,
    course: {
      id: enrollment.course.id,
      title: enrollment.course.title,
      slug: enrollment.course.slug,
    },
    student: enrollment.student,
  };
}

export function presentManagedEnrollment(
  enrollment: CourseEnrollmentRecord,
): ManagedEnrollmentResponse {
  return {
    ...presentSelfEnrollment(enrollment),
    createdById: enrollment.createdById,
    course: {
      id: enrollment.course.id,
      title: enrollment.course.title,
      slug: enrollment.course.slug,
      teacherId: enrollment.course.teacherId,
    },
  };
}

export function presentSelfEnrollmentPage(
  result: PaginatedEnrollments,
): PaginatedEnrollmentResponse<SelfEnrollmentResponse> {
  return {
    items: result.items.map(presentSelfEnrollment),
    pagination: result.pagination,
  };
}

export function presentManagedEnrollmentPage(
  result: PaginatedEnrollments,
): PaginatedEnrollmentResponse<ManagedEnrollmentResponse> {
  return {
    items: result.items.map(presentManagedEnrollment),
    pagination: result.pagination,
  };
}
