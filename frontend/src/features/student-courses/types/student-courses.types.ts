export type CourseLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type EnrollmentStatus = 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'COMPLETED';

export interface Pagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface CatalogCourse {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  level: CourseLevel;
  estimatedDurationMinutes: number | null;
  publishedAt: string;
}

export interface CatalogCoursePage {
  items: CatalogCourse[];
  pagination: Pagination;
}

export interface StudentEnrollment {
  id: string;
  courseId: string;
  studentId: string;
  status: EnrollmentStatus;
  enrolledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  suspendedAt: string | null;
  createdAt: string;
  updatedAt: string;
  course: {
    id: string;
    title: string;
    slug: string;
  };
}

export interface StudentEnrollmentPage {
  items: StudentEnrollment[];
  pagination: Pagination;
}
