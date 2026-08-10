import type { Pagination } from '../../progress';

export type TeacherCourseLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type TeacherCourseStatus = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'ARCHIVED';

export interface TeacherCourseTeacher {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
}

export interface TeacherCourse {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  contentLanguage: string;
  level: TeacherCourseLevel | null;
  status: TeacherCourseStatus;
  teacher: TeacherCourseTeacher | null;
  estimatedDurationMinutes: number | null;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface TeacherCoursePage {
  items: TeacherCourse[];
  pagination: Pagination;
}

export interface CourseEnrollmentPage {
  items: Array<{ id: string; status: string }>;
  pagination: Pagination;
}

export interface TeacherCourseListQuery {
  page: number;
  pageSize: number;
  deleted: 'exclude';
  sortBy: 'updatedAt';
  sortDirection: 'desc';
}

export interface CreateTeacherCourseInput {
  title: string;
  shortDescription?: string;
  description?: string;
  level?: TeacherCourseLevel;
}

export interface UpdateTeacherCourseInput {
  title?: string;
  shortDescription?: string | null;
  description?: string | null;
  level?: TeacherCourseLevel | null;
}
