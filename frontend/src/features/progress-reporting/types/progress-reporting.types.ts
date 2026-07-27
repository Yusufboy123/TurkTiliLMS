import type {
  CourseProgress,
  CourseProgressState,
  EnrollmentStatus,
  Pagination,
} from '../../progress';

export type ReportingSortField =
  'lastActivityAt' | 'completedAt' | 'percentage' | 'enrolledAt' | 'studentName';

export interface ProgressReportingQuery {
  page: number;
  pageSize: number;
  search?: string;
  courseId?: string;
  studentId?: string;
  enrollmentStatus?: EnrollmentStatus;
  progressState?: CourseProgressState;
  sortBy: ReportingSortField;
  sortDirection: 'asc' | 'desc';
}

export interface StudentReference {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
}

export interface ReportingCapabilities {
  canReadDetail: boolean;
  canExport: false;
  exportRequiresStepUp: true;
}

export interface StudentProgressReport {
  enrollmentId: string;
  student: StudentReference;
  enrollmentStatus: EnrollmentStatus;
  progressStatus: CourseProgressState;
  percentage: number;
  completedLessons: number;
  totalEligibleLessons: number;
  lastActivityAt: string | null;
  completedAt: string | null;
  capabilities: ReportingCapabilities;
}

export interface TeacherCourseProgressPage {
  course: { id: string; title: string; slug: string };
  curriculumVersion: number;
  activeEnrollmentCount: number;
  suspendedEnrollmentCount: number;
  completedEnrollmentCount: number;
  cancelledEnrollmentCount: number;
  averageProgressPercentage: number;
  items: StudentProgressReport[];
  pagination: Pagination;
  capabilities: ReportingCapabilities;
}

export interface AdminProgressPage {
  generatedAt: string;
  totalEnrollments: number;
  activeLearners: number;
  completedEnrollments: number;
  averageProgressPercentage: number;
  items: StudentProgressReport[];
  pagination: Pagination;
  capabilities: ReportingCapabilities;
}

export interface StudentProgressDetail {
  student: StudentReference;
  progress: CourseProgress;
  capabilities: ReportingCapabilities;
}
