import type { CourseLevel, CourseStatus, RoleCode } from '@prisma/client';

export const courseSortFields = [
  'createdAt',
  'updatedAt',
  'title',
  'publishedAt',
  'sortOrder',
] as const;

export const catalogSortFields = ['title', 'publishedAt', 'sortOrder'] as const;

export type CourseSortField = (typeof courseSortFields)[number];
export type CatalogSortField = (typeof catalogSortFields)[number];
export type SortDirection = 'asc' | 'desc';
export type DeletedCourseFilter = 'exclude' | 'include' | 'only';

export interface CourseTeacherSummary {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
}

export interface CourseRecord {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  coverImageUrl: string | null;
  contentLanguage: string;
  level: CourseLevel | null;
  status: CourseStatus;
  createdByUserId: string;
  teacher: CourseTeacherSummary | null;
  estimatedDurationMinutes: number | null;
  sortOrder: number;
  isFeatured: boolean;
  publishedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CatalogCourse {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  coverImageUrl: string | null;
  contentLanguage: string;
  level: CourseLevel;
  teacher: CourseTeacherSummary;
  estimatedDurationMinutes: number | null;
  sortOrder: number;
  isFeatured: boolean;
  publishedAt: Date;
}

export interface CourseListQuery {
  page: number;
  pageSize: number;
  search?: string | undefined;
  level?: CourseLevel | undefined;
  status?: CourseStatus | undefined;
  teacherId?: string | undefined;
  featured?: boolean | undefined;
  deleted: DeletedCourseFilter;
  sortBy: CourseSortField;
  sortDirection: SortDirection;
}

export interface CatalogCourseListQuery {
  page: number;
  pageSize: number;
  search?: string | undefined;
  level?: CourseLevel | undefined;
  featured?: boolean | undefined;
  sortBy: CatalogSortField;
  sortDirection: SortDirection;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface CreateCourseData {
  title: string;
  slug: string;
  shortDescription?: string | undefined;
  description?: string | undefined;
  coverImageUrl?: string | undefined;
  contentLanguage: string;
  level?: CourseLevel | undefined;
  teacherId?: string | undefined;
  estimatedDurationMinutes?: number | undefined;
  sortOrder: number;
  isFeatured: boolean;
  createdByUserId: string;
}

export interface UpdateCourseData {
  title?: string | undefined;
  slug?: string | undefined;
  shortDescription?: string | null | undefined;
  description?: string | null | undefined;
  coverImageUrl?: string | null | undefined;
  contentLanguage?: string | undefined;
  level?: CourseLevel | null | undefined;
  estimatedDurationMinutes?: number | null | undefined;
  sortOrder?: number | undefined;
  isFeatured?: boolean | undefined;
}

export interface CourseActor {
  userId: string;
  roles: RoleCode[];
  permissions: string[];
}

export interface CourseAuditContext {
  actorUserId: string;
  requestCorrelationId?: string;
  ipHash?: string;
  userAgentSummary?: string;
}

export interface CourseStatistics {
  total: number;
  draft: number;
  inReview: number;
  published: number;
  archived: number;
  deleted: number;
  featured: number;
  byLevel: Record<CourseLevel, number>;
  byTeacher: Array<{
    teacherId: string;
    displayName: string;
    count: number;
  }>;
}
