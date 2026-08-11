import type { RoleCode, UserStatus } from '../../auth/types/auth.types';

export type AdminUserRole = RoleCode;
export type AdminUserStatus = UserStatus;
export type EnrollmentStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'SUSPENDED';

export interface AdminUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  status: AdminUserStatus;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  hasPassword: boolean;
  roles: AdminUserRole[];
}

export interface AdminUserDetail extends AdminUser {
  activeSessionCount: number;
}

export interface AdminUserPage {
  items: AdminUser[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

export interface AdminCourse {
  id: string;
  title: string;
  status: 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'ARCHIVED';
  teacher: { id: string; firstName: string | null; lastName: string | null; displayName: string | null } | null;
}

export interface AdminCoursePage {
  items: AdminCourse[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

export interface AdminEnrollment {
  id: string;
  courseId: string;
  studentId: string;
  status: EnrollmentStatus;
  enrolledAt: string;
  course: { id: string; title: string; slug: string; teacherId: string | null };
}

export interface AdminEnrollmentPage {
  items: AdminEnrollment[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

export interface AdminStudentCourse {
  enrollmentId: string;
  course: { id: string; title: string; slug: string };
  enrollmentStatus: EnrollmentStatus;
  percentage: number;
  completedLessons: number;
  totalEligibleLessons: number;
  lastActivityAt: string | null;
  completedAt: string | null;
  currentLesson: { id: string; title: string; sectionTitle: string } | null;
  certificateStatus: 'ISSUED' | 'REVOKED' | null;
}

export interface AdminStudentDetail {
  student: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    displayName: string | null;
    registeredAt: string;
  };
  overallPercentage: number;
  completedCourses: number;
  courses: AdminStudentCourse[];
}

export interface CertificateEligibility {
  enrollmentId: string;
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
    evaluationVersion: number | null;
  };
}

export interface CertificateStatus {
  status: 'NOT_ISSUED' | 'ISSUED' | 'REVOKED';
  certificate: {
    certificateId: string;
    certificateNumber: string;
    version: number;
    issuedAt: string;
    revokedAt: string | null;
  } | null;
}
