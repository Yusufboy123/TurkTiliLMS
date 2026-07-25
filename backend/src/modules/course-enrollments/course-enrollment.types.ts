import type {
  CourseEnrollmentSource,
  CourseEnrollmentStatus,
  CourseStatus,
  RoleCode,
} from '@prisma/client';

export const enrollmentSortFields = ['enrolledAt', 'createdAt', 'updatedAt', 'status'] as const;

export type EnrollmentSortField = (typeof enrollmentSortFields)[number];
export type SortDirection = 'asc' | 'desc';

export interface EnrollmentCourseAccess {
  id: string;
  title: string;
  slug: string;
  status: CourseStatus;
  publishedAt: Date | null;
  deletedAt: Date | null;
  teacherId: string | null;
}

export interface EnrollmentStudentSummary {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
}

export interface CourseEnrollmentRecord {
  id: string;
  courseId: string;
  studentId: string;
  status: CourseEnrollmentStatus;
  source: CourseEnrollmentSource;
  enrolledAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  suspendedAt: Date | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  course: {
    id: string;
    title: string;
    slug: string;
    teacherId: string | null;
  };
  student: EnrollmentStudentSummary;
}

export interface EnrollmentListQuery {
  page: number;
  pageSize: number;
  status?: CourseEnrollmentStatus | undefined;
  source?: CourseEnrollmentSource | undefined;
  search?: string | undefined;
  studentId?: string | undefined;
  courseId?: string | undefined;
  enrolledFrom?: Date | undefined;
  enrolledTo?: Date | undefined;
  sortBy: EnrollmentSortField;
  sortDirection: SortDirection;
}

export interface PaginatedEnrollments {
  items: CourseEnrollmentRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface EnrollmentActor {
  userId: string;
  roles: RoleCode[];
  permissions: string[];
}

export interface EnrollmentAuditContext {
  actorUserId: string;
  requestCorrelationId?: string;
  ipHash?: string;
  userAgentSummary?: string;
}

export interface CreateEnrollmentData {
  courseId: string;
  studentId: string;
  source: CourseEnrollmentSource;
  createdById: string | null;
}

export interface SelfEnrollmentResponse {
  id: string;
  courseId: string;
  studentId: string;
  status: CourseEnrollmentStatus;
  source: CourseEnrollmentSource;
  enrolledAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  suspendedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  course: {
    id: string;
    title: string;
    slug: string;
  };
  student: EnrollmentStudentSummary;
}

export interface ManagedEnrollmentResponse extends SelfEnrollmentResponse {
  createdById: string | null;
  course: SelfEnrollmentResponse['course'] & {
    teacherId: string | null;
  };
}

export interface PaginatedEnrollmentResponse<T> {
  items: T[];
  pagination: PaginatedEnrollments['pagination'];
}
