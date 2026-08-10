export type EnrollmentStatus = 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'COMPLETED';
export type CertificateStatus = 'ISSUED' | 'REVOKED';

export interface StudentReference {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  registeredAt: string;
}

export interface TeacherStudentListItem extends StudentReference {
  overallPercentage: number;
  currentCourse: { id: string; title: string } | null;
  lastActivityAt: string | null;
  enrollmentCount: number;
}

export interface TeacherStudentPage {
  items: TeacherStudentListItem[];
  newStudentCount: number;
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

export interface StudentCourseMonitoring {
  enrollmentId: string;
  course: { id: string; title: string; slug: string };
  enrollmentStatus: EnrollmentStatus;
  percentage: number;
  completedLessons: number;
  totalEligibleLessons: number;
  lastActivityAt: string | null;
  completedAt: string | null;
  currentLesson: { id: string; title: string; sectionTitle: string } | null;
  certificateStatus: CertificateStatus | null;
}

export interface TeacherStudentDetail {
  student: StudentReference;
  overallPercentage: number;
  completedCourses: number;
  courses: StudentCourseMonitoring[];
}
