import type { LessonStatus, LessonType } from '@prisma/client';
import type {
  CourseActor,
  CourseAuditContext,
  CourseTeacherSummary,
  PaginatedResult,
  SortDirection,
} from '../courses/course.types.js';

export type ContentActor = CourseActor;
export type ContentAuditContext = CourseAuditContext;

export interface CourseSectionRecord {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  position: number;
  isPublished: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  lessonCount: number;
}

export interface SectionLessonSummary {
  id: string;
  title: string;
  slug: string;
  lessonType: LessonType;
  position: number;
  durationMinutes: number | null;
  isPreview: boolean;
  status: LessonStatus;
}

export interface CourseSectionDetail extends CourseSectionRecord {
  lessons: SectionLessonSummary[];
}

export interface LessonRecord {
  id: string;
  courseId: string;
  section: {
    id: string;
    title: string;
    position: number;
    isPublished: boolean;
    deletedAt: Date | null;
  };
  course: {
    id: string;
    title: string;
    slug: string;
  };
  title: string;
  slug: string;
  summary: string | null;
  content: string | null;
  lessonType: LessonType;
  position: number;
  durationMinutes: number | null;
  isPreview: boolean;
  status: LessonStatus;
  createdBy: CourseTeacherSummary;
  teacher: CourseTeacherSummary | null;
  publishedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export const lessonSortFields = [
  'createdAt',
  'updatedAt',
  'title',
  'publishedAt',
  'position',
] as const;

export type LessonSortField = (typeof lessonSortFields)[number];

export interface LessonListQuery {
  page: number;
  pageSize: number;
  sectionId?: string | undefined;
  status?: LessonStatus | undefined;
  lessonType?: LessonType | undefined;
  teacherId?: string | undefined;
  isPreview?: boolean | undefined;
  search?: string | undefined;
  includeDeleted: boolean;
  sortBy: LessonSortField;
  sortDirection: SortDirection;
}

export interface CreateSectionData {
  title: string;
  description?: string | undefined;
  position?: number | undefined;
  createdById: string;
}

export interface UpdateSectionData {
  title?: string | undefined;
  description?: string | null | undefined;
  isPublished?: boolean | undefined;
}

export interface CreateLessonData {
  sectionId: string;
  title: string;
  slug: string;
  summary?: string | undefined;
  content?: string | undefined;
  lessonType: LessonType;
  position?: number | undefined;
  durationMinutes?: number | undefined;
  isPreview: boolean;
  createdById: string;
  teacherId?: string | undefined;
}

export interface UpdateLessonData {
  title?: string | undefined;
  slug?: string | undefined;
  summary?: string | null | undefined;
  content?: string | null | undefined;
  lessonType?: LessonType | undefined;
  durationMinutes?: number | null | undefined;
  isPreview?: boolean | undefined;
}

export interface LessonStatistics {
  total: number;
  draft: number;
  inReview: number;
  published: number;
  archived: number;
  deleted: number;
  preview: number;
  byType: Record<LessonType, number>;
}

export interface CatalogCurriculum {
  course: {
    id: string;
    title: string;
    slug: string;
  };
  sections: Array<{
    id: string;
    title: string;
    description: string | null;
    position: number;
    lessons: Array<{
      id: string;
      title: string;
      slug: string;
      lessonType: LessonType;
      position: number;
      durationMinutes: number | null;
      isPreview: boolean;
    }>;
  }>;
}

export interface CatalogLesson {
  id: string;
  courseId: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string | null;
  lessonType: LessonType;
  durationMinutes: number | null;
  isPreview: boolean;
  publishedAt: Date;
  section: { id: string; title: string };
}

export type LessonPage = PaginatedResult<LessonRecord>;
