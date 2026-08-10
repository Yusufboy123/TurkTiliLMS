import type { Pagination } from '../../progress';

export type TeacherLessonType = 'TEXT' | 'VIDEO' | 'AUDIO' | 'PDF' | 'QUIZ' | 'ASSIGNMENT' | 'LIVE';
export type TeacherLessonStatus = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'ARCHIVED';
export type TeacherLessonBlockType = 'TEXT' | 'VIDEO' | 'AUDIO' | 'PDF' | 'DOCUMENT' | 'IMAGE' | 'LINK' | 'DOWNLOAD';

export interface TeacherSection {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  position: number;
  isPublished: boolean;
  deletedAt: string | null;
  lessonCount: number;
}

export interface TeacherLesson {
  id: string;
  courseId: string;
  section: {
    id: string;
    title: string;
    position: number;
    isPublished: boolean;
    deletedAt: string | null;
  };
  course: { id: string; title: string; slug: string };
  title: string;
  slug: string;
  summary: string | null;
  content: string | null;
  lessonType: TeacherLessonType;
  position: number;
  durationMinutes: number | null;
  isPreview: boolean;
  status: TeacherLessonStatus;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface TeacherLessonPage {
  items: TeacherLesson[];
  pagination: Pagination;
}

export interface TeacherContentBlock {
  id: string;
  lessonId: string;
  mediaFileId: string | null;
  blockType: TeacherLessonBlockType;
  title: string | null;
  description: string | null;
  position: number;
  isRequired: boolean;
  isVisible: boolean;
  textContent: string | null;
  sourceUrl: string | null;
  externalProvider: string | null;
  fileUrl: string | null;
  mimeType: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  deletedAt: string | null;
}

export interface TeacherContentBlockPage {
  items: TeacherContentBlock[];
  pagination: Pagination;
}

export interface TeacherLessonListQuery {
  page: number;
  pageSize: number;
  includeDeleted: false;
  sortBy: 'position';
  sortDirection: 'asc';
}

export interface CreateTeacherLessonInput {
  sectionId: string;
  title: string;
  summary?: string;
  lessonType: TeacherLessonType;
  position?: number;
  isPreview: boolean;
}

export interface UpdateTeacherLessonInput {
  title?: string;
  summary?: string | null;
  lessonType?: TeacherLessonType;
  isPreview?: boolean;
}

export interface ReorderTeacherLessonInput {
  sectionId?: string;
  position: number;
}

export interface CreateTeacherSectionInput {
  title: string;
}

export interface CreateTeacherBlockInput {
  blockType: Extract<TeacherLessonBlockType, 'TEXT' | 'VIDEO' | 'AUDIO'>;
  title?: string;
  textContent?: string;
  sourceUrl?: string;
  isRequired: boolean;
  isVisible: boolean;
}

export interface UpdateTeacherBlockInput {
  title?: string | null;
  textContent?: string | null;
  sourceUrl?: string | null;
  isRequired?: boolean;
}
