import type { Pagination } from '../../progress';

export type TeacherCourseLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type TeacherCourseStatus = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'ARCHIVED';

export interface AssignedTeacherCourse {
  id: string;
  title: string;
  slug: string;
  level: TeacherCourseLevel | null;
  status: TeacherCourseStatus;
  updatedAt: string;
}

export interface AssignedTeacherCoursePage {
  items: AssignedTeacherCourse[];
  pagination: Pagination;
}

export interface AssignedTeacherCourseQuery {
  page: number;
  pageSize: number;
  deleted: 'exclude';
  sortBy: 'updatedAt';
  sortDirection: 'desc';
}
