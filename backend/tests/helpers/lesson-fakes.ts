import { LessonStatus, LessonType } from '@prisma/client';
import type { LessonManagementRepository } from '../../src/modules/lessons/lesson-management.repository.js';
import type {
  CatalogCurriculum,
  CatalogLesson,
  ContentAuditContext,
  CourseSectionDetail,
  CourseSectionRecord,
  CreateLessonData,
  CreateSectionData,
  LessonListQuery,
  LessonRecord,
  LessonStatistics,
  UpdateLessonData,
  UpdateSectionData,
} from '../../src/modules/lessons/lesson-management.types.js';
import { COURSE_TEACHER_ID, TEST_COURSE_ID } from './course-fakes.js';

export const SECTION_ID = '019b9e22-f35f-7eca-83fb-cc1e8b0f6101';
export const OTHER_SECTION_ID = '019b9e23-01e4-7de0-826f-c6f34c10a2af';
export const LESSON_ID = '019b9e23-1147-7f4b-9726-e46482877c65';

export function section(overrides: Partial<CourseSectionDetail> = {}): CourseSectionDetail {
  return {
    id: SECTION_ID,
    courseId: TEST_COURSE_ID,
    title: 'Kirish',
    description: null,
    position: 1,
    isPublished: false,
    createdById: COURSE_TEACHER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    lessonCount: 0,
    lessons: [],
    ...overrides,
  };
}

export function lesson(overrides: Partial<LessonRecord> = {}): LessonRecord {
  return {
    id: LESSON_ID,
    courseId: TEST_COURSE_ID,
    course: { id: TEST_COURSE_ID, title: 'Turk tili A1', slug: 'turk-tili-a1' },
    section: {
      id: SECTION_ID,
      title: 'Kirish',
      position: 1,
      isPublished: false,
      deletedAt: null,
    },
    title: 'Salomlashish',
    slug: 'salomlashish',
    summary: null,
    content: 'Dars mazmuni',
    lessonType: LessonType.TEXT,
    position: 1,
    durationMinutes: 10,
    isPreview: false,
    status: LessonStatus.DRAFT,
    createdBy: {
      id: COURSE_TEACHER_ID,
      firstName: 'Ali',
      lastName: 'Ustoz',
      displayName: 'Ali Ustoz',
    },
    teacher: null,
    publishedAt: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

export class FakeLessonRepository implements LessonManagementRepository {
  currentSection: CourseSectionDetail | null = section();
  currentLesson: LessonRecord | null = lesson();
  slugConflict = false;
  sectionNotEmpty = false;
  lastCreateLesson: CreateLessonData | null = null;
  lastCreateSection: CreateSectionData | null = null;
  lastScopedQuery: LessonListQuery | null = null;
  curriculumResult: CatalogCurriculum | null = null;
  catalogLessonResult: CatalogLesson | null = null;

  listSections(): Promise<CourseSectionRecord[]> {
    return Promise.resolve(this.currentSection ? [this.currentSection] : []);
  }
  findSection(_courseId: string, sectionId: string): Promise<CourseSectionDetail | null> {
    return Promise.resolve(this.currentSection?.id === sectionId ? this.currentSection : null);
  }
  createSection(_courseId: string, data: CreateSectionData): Promise<CourseSectionRecord> {
    this.lastCreateSection = data;
    this.currentSection = section({ title: data.title, position: data.position ?? 1 });
    return Promise.resolve(this.currentSection);
  }
  updateSection(
    _courseId: string,
    _sectionId: string,
    data: UpdateSectionData,
  ): Promise<CourseSectionRecord | null> {
    if (!this.currentSection) return Promise.resolve(null);
    this.currentSection = {
      ...this.currentSection,
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.isPublished !== undefined ? { isPublished: data.isPublished } : {}),
    };
    return Promise.resolve(this.currentSection);
  }
  reorderSection(
    _courseId: string,
    _sectionId: string,
    position: number,
  ): Promise<CourseSectionRecord | null> {
    if (!this.currentSection) return Promise.resolve(null);
    this.currentSection = { ...this.currentSection, position };
    return Promise.resolve(this.currentSection);
  }
  deleteSection(): Promise<CourseSectionRecord | null> {
    if (this.sectionNotEmpty) {
      const error = new Error();
      error.name = 'SectionNotEmptyError';
      return Promise.reject(error);
    }
    if (!this.currentSection) return Promise.resolve(null);
    this.currentSection = { ...this.currentSection, deletedAt: new Date() };
    return Promise.resolve(this.currentSection);
  }
  restoreSection(): Promise<CourseSectionRecord | null> {
    if (!this.currentSection) return Promise.resolve(null);
    this.currentSection = { ...this.currentSection, deletedAt: null, isPublished: false };
    return Promise.resolve(this.currentSection);
  }
  listLessons(
    _courseId: string,
    query: LessonListQuery,
  ): Promise<{ items: LessonRecord[]; total: number }> {
    this.lastScopedQuery = query;
    return Promise.resolve({
      items: this.currentLesson ? [this.currentLesson] : [],
      total: this.currentLesson ? 1 : 0,
    });
  }
  findLesson(): Promise<LessonRecord | null> {
    return Promise.resolve(this.currentLesson);
  }
  createLesson(_courseId: string, data: CreateLessonData): Promise<LessonRecord> {
    if (this.slugConflict) {
      return import('../../src/modules/lessons/lesson-management.repository.js').then(
        ({ LessonSlugConflictError }) => Promise.reject(new LessonSlugConflictError()),
      );
    }
    this.lastCreateLesson = data;
    this.currentLesson = lesson({
      title: data.title,
      slug: data.slug,
      lessonType: data.lessonType,
      position: data.position ?? 1,
    });
    return Promise.resolve(this.currentLesson);
  }
  updateLesson(
    _courseId: string,
    _lessonId: string,
    data: UpdateLessonData,
  ): Promise<LessonRecord | null> {
    if (!this.currentLesson) return Promise.resolve(null);
    this.currentLesson = {
      ...this.currentLesson,
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.slug !== undefined ? { slug: data.slug } : {}),
      ...(data.summary !== undefined ? { summary: data.summary } : {}),
      ...(data.content !== undefined ? { content: data.content } : {}),
      ...(data.lessonType !== undefined ? { lessonType: data.lessonType } : {}),
      ...(data.durationMinutes !== undefined ? { durationMinutes: data.durationMinutes } : {}),
      ...(data.isPreview !== undefined ? { isPreview: data.isPreview } : {}),
    };
    return Promise.resolve(this.currentLesson);
  }
  updateLessonStatus(
    _courseId: string,
    _lessonId: string,
    status: LessonStatus,
  ): Promise<LessonRecord | null> {
    if (!this.currentLesson) return Promise.resolve(null);
    this.currentLesson = {
      ...this.currentLesson,
      status,
      ...(status === LessonStatus.PUBLISHED ? { publishedAt: new Date() } : {}),
    };
    return Promise.resolve(this.currentLesson);
  }
  assignLessonTeacher(): Promise<LessonRecord | null> {
    return Promise.resolve(this.currentLesson);
  }
  reorderLesson(
    _courseId: string,
    _lessonId: string,
    sectionId: string,
    position: number,
  ): Promise<LessonRecord | null> {
    if (!this.currentLesson) return Promise.resolve(null);
    this.currentLesson = {
      ...this.currentLesson,
      section: { ...this.currentLesson.section, id: sectionId },
      position,
    };
    return Promise.resolve(this.currentLesson);
  }
  deleteLesson(): Promise<LessonRecord | null> {
    if (!this.currentLesson) return Promise.resolve(null);
    this.currentLesson = { ...this.currentLesson, deletedAt: new Date() };
    return Promise.resolve(this.currentLesson);
  }
  restoreLesson(): Promise<LessonRecord | null> {
    if (!this.currentLesson) return Promise.resolve(null);
    this.currentLesson = { ...this.currentLesson, deletedAt: null, status: LessonStatus.DRAFT };
    return Promise.resolve(this.currentLesson);
  }
  lessonStatistics(): Promise<LessonStatistics> {
    return Promise.resolve({
      total: 1,
      draft: 1,
      inReview: 0,
      published: 0,
      archived: 0,
      deleted: 0,
      preview: 0,
      byType: { TEXT: 1, VIDEO: 0, AUDIO: 0, PDF: 0, QUIZ: 0, ASSIGNMENT: 0, LIVE: 0 },
    });
  }
  catalogCurriculum(): Promise<CatalogCurriculum | null> {
    return Promise.resolve(this.curriculumResult);
  }
  catalogLesson(): Promise<CatalogLesson | null> {
    return Promise.resolve(this.catalogLessonResult);
  }
}

export const contentAudit: ContentAuditContext = { actorUserId: COURSE_TEACHER_ID };
