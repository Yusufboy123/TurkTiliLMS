import type { CourseEnrollmentStatus, RoleCode } from '@prisma/client';
import type {
  CourseProgressDto,
  PaginationDto,
  ProgressEnrollmentRecord,
  ProjectedCourseProgressState,
} from '../progress-tracking/progress-tracking.types.js';

export type ReportingSortField =
  'lastActivityAt' | 'completedAt' | 'percentage' | 'enrolledAt' | 'studentName';

export interface ProgressReportingQuery {
  page: number;
  pageSize: number;
  search?: string | undefined;
  courseId?: string | undefined;
  studentId?: string | undefined;
  enrollmentStatus?: CourseEnrollmentStatus | undefined;
  progressState?: ProjectedCourseProgressState | undefined;
  sortBy: ReportingSortField;
  sortDirection: 'asc' | 'desc';
}

export interface ProgressReportingActor {
  userId: string;
  roles: RoleCode[];
  permissions: string[];
}

export interface ReportingCourseRecord {
  id: string;
  title: string;
  slug: string;
  curriculumVersion: number;
  teacherId: string | null;
}

export interface ReportingStudentReference {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
}

export interface ReportingEnrollmentRecord {
  id: string;
  courseId: string;
  studentId: string;
  status: CourseEnrollmentStatus;
  enrolledAt: Date;
  completedAt: Date | null;
  student: ReportingStudentReference;
  progressRoot: {
    firstActivityAt: Date | null;
    lastVisitedAt: Date | null;
    completedLessons: number;
    totalEligibleLessons: number;
    coursePercentage: number;
  } | null;
}

export interface ReportingCapabilitiesDto {
  canReadDetail: true;
  canExport: false;
  exportRequiresStepUp: true;
}

export interface TeacherStudentProgressDto {
  enrollmentId: string;
  student: ReportingStudentReference;
  enrollmentStatus: CourseEnrollmentStatus;
  progressStatus: ProjectedCourseProgressState;
  percentage: number;
  completedLessons: number;
  totalEligibleLessons: number;
  lastActivityAt: string | null;
  completedAt: string | null;
  capabilities: ReportingCapabilitiesDto;
}

export interface TeacherCourseProgressPageDto {
  course: Pick<ReportingCourseRecord, 'id' | 'title' | 'slug'>;
  curriculumVersion: number;
  activeEnrollmentCount: number;
  suspendedEnrollmentCount: number;
  completedEnrollmentCount: number;
  cancelledEnrollmentCount: number;
  averageProgressPercentage: number;
  items: TeacherStudentProgressDto[];
  pagination: PaginationDto;
  capabilities: ReportingCapabilitiesDto;
}

export interface AdminProgressPageDto {
  generatedAt: string;
  totalEnrollments: number;
  activeLearners: number;
  completedEnrollments: number;
  averageProgressPercentage: number;
  items: TeacherStudentProgressDto[];
  pagination: PaginationDto;
  capabilities: ReportingCapabilitiesDto;
}

export interface TeacherStudentProgressDetailDto {
  student: ReportingStudentReference;
  progress: CourseProgressDto;
  capabilities: ReportingCapabilitiesDto;
}

export interface DetailedReportingEnrollment {
  enrollment: ProgressEnrollmentRecord;
  student: ReportingStudentReference;
  teacherId: string | null;
}

export interface CourseReportingStatistics {
  active: number;
  suspended: number;
  completed: number;
  cancelled: number;
  averagePercentage: number;
}

export interface AdminReportingStatistics {
  total: number;
  active: number;
  completed: number;
  averagePercentage: number;
}

export interface ReportingAuditContext {
  actorUserId: string;
  requestCorrelationId?: string;
  ipHash?: string;
  userAgentSummary?: string;
}
