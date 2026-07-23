import { CourseLevel, CourseStatus, RoleCode } from '@prisma/client';
import {
  CourseSlugConflictError,
  type CourseRepository,
} from '../../src/modules/courses/course.repository.js';
import type {
  CatalogCourse,
  CatalogCourseListQuery,
  CourseAuditContext,
  CourseListQuery,
  CourseRecord,
  CourseStatistics,
  CreateCourseData,
  UpdateCourseData,
} from '../../src/modules/courses/course.types.js';

export const COURSE_ADMIN_ID = '019b9e22-7f5d-7d3a-a0f1-ff64c8124a11';
export const COURSE_TEACHER_ID = '019b9e22-8f9c-771a-9753-67ad8f179af2';
export const OTHER_TEACHER_ID = '019b9e22-9a70-772d-bcfe-497e36c6de0d';
export const TEST_COURSE_ID = '019b9e22-a88b-77bb-b9f5-1449738a39ca';

export const courseAuditContext: CourseAuditContext = {
  actorUserId: COURSE_ADMIN_ID,
  requestCorrelationId: '019b9e22-b599-7c30-a2b1-a4fa6f3c2de7',
  ipHash: 'b'.repeat(64),
  userAgentSummary: 'Vitest',
};

export function createCourseRecord(overrides: Partial<CourseRecord> = {}): CourseRecord {
  return {
    id: TEST_COURSE_ID,
    title: 'Turk tili A1',
    slug: 'turk-tili-a1',
    shortDescription: 'Boshlang‘ich turk tili kursi',
    description: 'Turk tilini boshlang‘ich darajada o‘rganish uchun to‘liq kurs.',
    coverImageUrl: 'https://example.com/course.jpg',
    contentLanguage: 'tr',
    level: CourseLevel.A1,
    status: CourseStatus.DRAFT,
    createdByUserId: COURSE_ADMIN_ID,
    teacher: {
      id: COURSE_TEACHER_ID,
      firstName: 'Ali',
      lastName: 'Ustoz',
      displayName: 'Ali Ustoz',
    },
    estimatedDurationMinutes: 600,
    sortOrder: 0,
    isFeatured: false,
    publishedAt: null,
    archivedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

function toCatalog(course: CourseRecord): CatalogCourse | null {
  if (
    course.status !== CourseStatus.PUBLISHED ||
    course.deletedAt ||
    !course.level ||
    !course.teacher ||
    !course.publishedAt
  ) {
    return null;
  }

  return {
    id: course.id,
    title: course.title,
    slug: course.slug,
    shortDescription: course.shortDescription,
    description: course.description,
    coverImageUrl: course.coverImageUrl,
    contentLanguage: course.contentLanguage,
    level: course.level,
    teacher: course.teacher,
    estimatedDurationMinutes: course.estimatedDurationMinutes,
    sortOrder: course.sortOrder,
    isFeatured: course.isFeatured,
    publishedAt: course.publishedAt,
  };
}

export class FakeCourseRepository implements CourseRepository {
  readonly courses = new Map<string, CourseRecord>();
  readonly eligibleTeachers = new Set([COURSE_TEACHER_ID, OTHER_TEACHER_ID]);
  lastListQuery: CourseListQuery | null = null;
  lastScopedTeacherId: string | undefined;
  lastCreateData: CreateCourseData | null = null;
  lastAuditContext: CourseAuditContext | null = null;
  createSlugConflict = false;
  updateSlugConflict = false;
  statisticsResult: CourseStatistics = {
    total: 1,
    draft: 1,
    inReview: 0,
    published: 0,
    archived: 0,
    deleted: 0,
    featured: 0,
    byLevel: {
      A1: 1,
      A2: 0,
      B1: 0,
      B2: 0,
      C1: 0,
      C2: 0,
    },
    byTeacher: [{ teacherId: COURSE_TEACHER_ID, displayName: 'Ali Ustoz', count: 1 }],
  };

  constructor(courses: CourseRecord[] = [createCourseRecord()]) {
    for (const course of courses) {
      this.courses.set(course.id, course);
    }
  }

  list(
    query: CourseListQuery,
    scopedTeacherId?: string,
  ): Promise<{ items: CourseRecord[]; total: number }> {
    this.lastListQuery = query;
    this.lastScopedTeacherId = scopedTeacherId;
    let courses = [...this.courses.values()];

    if (scopedTeacherId) {
      courses = courses.filter((course) => course.teacher?.id === scopedTeacherId);
    }

    if (query.search) {
      const search = query.search.toLocaleLowerCase('uz-Latn');
      courses = courses.filter((course) =>
        [course.title, course.slug, course.shortDescription ?? ''].some((value) =>
          value.toLocaleLowerCase('uz-Latn').includes(search),
        ),
      );
    }

    if (query.level) courses = courses.filter((course) => course.level === query.level);
    if (query.status) courses = courses.filter((course) => course.status === query.status);
    if (query.teacherId) {
      courses = courses.filter((course) => course.teacher?.id === query.teacherId);
    }
    if (query.featured !== undefined) {
      courses = courses.filter((course) => course.isFeatured === query.featured);
    }
    if (query.deleted === 'exclude') {
      courses = courses.filter((course) => course.deletedAt === null);
    } else if (query.deleted === 'only') {
      courses = courses.filter((course) => course.deletedAt !== null);
    }

    const total = courses.length;
    const offset = (query.page - 1) * query.pageSize;
    return Promise.resolve({
      items: courses.slice(offset, offset + query.pageSize),
      total,
    });
  }

  findById(courseId: string): Promise<CourseRecord | null> {
    return Promise.resolve(this.courses.get(courseId) ?? null);
  }

  create(data: CreateCourseData, context: CourseAuditContext): Promise<CourseRecord> {
    if (
      this.createSlugConflict ||
      [...this.courses.values()].some((course) => course.slug === data.slug)
    ) {
      return Promise.reject(new CourseSlugConflictError());
    }

    this.lastCreateData = data;
    this.lastAuditContext = context;
    const course = createCourseRecord({
      id: '019b9e22-c88f-7210-a22a-5756e4e9d005',
      title: data.title,
      slug: data.slug,
      shortDescription: data.shortDescription ?? null,
      description: data.description ?? null,
      coverImageUrl: data.coverImageUrl ?? null,
      contentLanguage: data.contentLanguage,
      level: data.level ?? null,
      createdByUserId: data.createdByUserId,
      teacher: data.teacherId
        ? {
            id: data.teacherId,
            firstName: 'Ali',
            lastName: 'Ustoz',
            displayName: 'Ali Ustoz',
          }
        : null,
      estimatedDurationMinutes: data.estimatedDurationMinutes ?? null,
      sortOrder: data.sortOrder,
      isFeatured: data.isFeatured,
    });
    this.courses.set(course.id, course);
    return Promise.resolve(course);
  }

  update(
    courseId: string,
    data: UpdateCourseData,
    context: CourseAuditContext,
  ): Promise<CourseRecord | null> {
    if (this.updateSlugConflict) {
      return Promise.reject(new CourseSlugConflictError());
    }

    const course = this.courses.get(courseId);

    if (!course) {
      return Promise.resolve(null);
    }

    this.lastAuditContext = context;
    const updated: CourseRecord = {
      ...course,
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.slug !== undefined ? { slug: data.slug } : {}),
      ...(data.shortDescription !== undefined ? { shortDescription: data.shortDescription } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.coverImageUrl !== undefined ? { coverImageUrl: data.coverImageUrl } : {}),
      ...(data.contentLanguage !== undefined ? { contentLanguage: data.contentLanguage } : {}),
      ...(data.level !== undefined ? { level: data.level } : {}),
      ...(data.estimatedDurationMinutes !== undefined
        ? { estimatedDurationMinutes: data.estimatedDurationMinutes }
        : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      ...(data.isFeatured !== undefined ? { isFeatured: data.isFeatured } : {}),
      updatedAt: new Date(),
    };
    this.courses.set(courseId, updated);
    return Promise.resolve(updated);
  }

  updateStatus(
    courseId: string,
    status: CourseStatus,
    context: CourseAuditContext,
  ): Promise<CourseRecord | null> {
    const course = this.courses.get(courseId);

    if (!course) {
      return Promise.resolve(null);
    }

    this.lastAuditContext = context;
    const updated: CourseRecord = {
      ...course,
      status,
      ...(status === CourseStatus.PUBLISHED ? { publishedAt: new Date() } : {}),
      ...(status === CourseStatus.ARCHIVED ? { archivedAt: new Date() } : {}),
      ...(status === CourseStatus.DRAFT && course.status === CourseStatus.ARCHIVED
        ? { publishedAt: null, archivedAt: null }
        : {}),
    };
    this.courses.set(courseId, updated);
    return Promise.resolve(updated);
  }

  assignTeacher(
    courseId: string,
    teacherId: string | null,
    context: CourseAuditContext,
  ): Promise<CourseRecord | null> {
    const course = this.courses.get(courseId);

    if (!course) {
      return Promise.resolve(null);
    }

    this.lastAuditContext = context;
    const updated = {
      ...course,
      teacher: teacherId
        ? {
            id: teacherId,
            firstName: 'Yangi',
            lastName: 'Ustoz',
            displayName: 'Yangi Ustoz',
          }
        : null,
    };
    this.courses.set(courseId, updated);
    return Promise.resolve(updated);
  }

  softDelete(courseId: string, context: CourseAuditContext): Promise<CourseRecord | null> {
    const course = this.courses.get(courseId);

    if (!course) {
      return Promise.resolve(null);
    }

    this.lastAuditContext = context;
    const deleted = { ...course, deletedAt: new Date() };
    this.courses.set(courseId, deleted);
    return Promise.resolve(deleted);
  }

  restore(courseId: string, context: CourseAuditContext): Promise<CourseRecord | null> {
    const course = this.courses.get(courseId);

    if (!course) {
      return Promise.resolve(null);
    }

    this.lastAuditContext = context;
    const restored = {
      ...course,
      status: CourseStatus.DRAFT,
      deletedAt: null,
      publishedAt: null,
      archivedAt: null,
    };
    this.courses.set(courseId, restored);
    return Promise.resolve(restored);
  }

  isEligibleTeacher(userId: string): Promise<boolean> {
    return Promise.resolve(this.eligibleTeachers.has(userId));
  }

  statistics(): Promise<CourseStatistics> {
    return Promise.resolve(this.statisticsResult);
  }

  listCatalog(query: CatalogCourseListQuery): Promise<{ items: CatalogCourse[]; total: number }> {
    let items = [...this.courses.values()]
      .map(toCatalog)
      .filter((course): course is CatalogCourse => course !== null);

    if (query.search) {
      const search = query.search.toLocaleLowerCase('uz-Latn');
      items = items.filter((course) =>
        [course.title, course.slug, course.shortDescription ?? ''].some((value) =>
          value.toLocaleLowerCase('uz-Latn').includes(search),
        ),
      );
    }
    if (query.level) items = items.filter((course) => course.level === query.level);
    if (query.featured !== undefined) {
      items = items.filter((course) => course.isFeatured === query.featured);
    }

    const total = items.length;
    const offset = (query.page - 1) * query.pageSize;
    return Promise.resolve({
      items: items.slice(offset, offset + query.pageSize),
      total,
    });
  }

  findCatalogBySlug(slug: string): Promise<CatalogCourse | null> {
    const course = [...this.courses.values()].find((item) => item.slug === slug);
    return Promise.resolve(course ? toCatalog(course) : null);
  }
}

export const adminCourseActor = {
  userId: COURSE_ADMIN_ID,
  roles: [RoleCode.ADMIN],
  permissions: [
    'courses.read',
    'courses.create',
    'courses.update',
    'courses.delete',
    'courses.restore',
    'courses.submit_review',
    'courses.publish',
    'courses.assign_teacher',
    'courses.view_statistics',
    'sections.read',
    'sections.create',
    'sections.update',
    'sections.delete',
    'sections.restore',
    'sections.reorder',
    'sections.publish',
    'lessons.read',
    'lessons.create',
    'lessons.update',
    'lessons.delete',
    'lessons.restore',
    'lessons.reorder',
    'lessons.submit_review',
    'lessons.publish',
    'lessons.assign_teacher',
    'lessons.view_statistics',
  ],
};

export const teacherCourseActor = {
  userId: COURSE_TEACHER_ID,
  roles: [RoleCode.TEACHER],
  permissions: [
    'courses.read',
    'courses.create',
    'courses.update',
    'courses.delete',
    'courses.restore',
    'courses.submit_review',
    'sections.read',
    'sections.create',
    'sections.update',
    'sections.delete',
    'sections.restore',
    'sections.reorder',
    'lessons.read',
    'lessons.create',
    'lessons.update',
    'lessons.delete',
    'lessons.restore',
    'lessons.reorder',
    'lessons.submit_review',
    'lessons.view_statistics',
  ],
};
