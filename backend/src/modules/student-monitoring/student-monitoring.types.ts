import type { CourseEnrollmentStatus, RoleCode } from '@prisma/client';

export interface StudentMonitoringActor {
  userId: string;
  roles: RoleCode[];
  permissions: string[];
}

export interface StudentMonitoringQuery {
  page: number;
  pageSize: number;
  search?: string | undefined;
}

export interface MonitoringCourseRecord {
  enrollmentId: string;
  course: { id: string; title: string; slug: string };
  enrollmentStatus: CourseEnrollmentStatus;
  accessStartsAt: Date;
  accessExpiresAt: Date;
  percentage: number;
  completedLessons: number;
  totalEligibleLessons: number;
  lastActivityAt: Date | null;
  completedAt: Date | null;
  currentLesson: { id: string; title: string; sectionTitle: string } | null;
  certificateStatus: 'ISSUED' | 'REVOKED' | null;
}

export interface MonitoringStudentReference {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  registeredAt: Date;
}

export interface MonitoringStudentListItem extends MonitoringStudentReference {
  overallPercentage: number;
  currentCourse: { id: string; title: string } | null;
  lastActivityAt: Date | null;
  enrollmentCount: number;
}

export interface MonitoringStudentDetail {
  student: MonitoringStudentReference;
  overallPercentage: number;
  completedCourses: number;
  courses: MonitoringCourseRecord[];
}

export interface StudentMonitoringPage {
  items: MonitoringStudentListItem[];
  newStudentCount: number;
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}
