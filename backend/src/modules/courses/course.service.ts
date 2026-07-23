import { CourseStatus, RoleCode } from '@prisma/client';
import { AppError } from '../../utils/app-error.js';
import { CourseSlugConflictError, type CourseRepository } from './course.repository.js';
import {
  courseSlugSchema,
  type CreateCourseInput,
  type UpdateCourseInput,
} from './course.schemas.js';
import { generateCourseSlug } from './course.slug.js';
import type {
  CatalogCourse,
  CatalogCourseListQuery,
  CourseActor,
  CourseAuditContext,
  CourseListQuery,
  CourseRecord,
  CourseStatistics,
  PaginatedResult,
} from './course.types.js';

const validTransitions: Record<CourseStatus, CourseStatus[]> = {
  DRAFT: [CourseStatus.IN_REVIEW],
  IN_REVIEW: [CourseStatus.DRAFT, CourseStatus.PUBLISHED],
  PUBLISHED: [CourseStatus.ARCHIVED],
  ARCHIVED: [CourseStatus.DRAFT],
};

function courseNotFound(): AppError {
  return new AppError('Kurs topilmadi.', 404, 'COURSE_NOT_FOUND');
}

function courseDeleted(): AppError {
  return new AppError('O‘chirilgan kursni avval tiklash kerak.', 409, 'COURSE_IS_DELETED');
}

function slugConflict(): AppError {
  return new AppError('Bu slug boshqa kurs tomonidan ishlatilmoqda.', 409, 'COURSE_SLUG_CONFLICT');
}

function isAdministrator(actor: CourseActor): boolean {
  return actor.roles.includes(RoleCode.ADMIN);
}

function assertTeacherScope(actor: CourseActor, course: CourseRecord): void {
  if (!isAdministrator(actor) && course.teacher?.id !== actor.userId) {
    throw new AppError('Bu kurs sizga biriktirilmagan.', 403, 'COURSE_SCOPE_DENIED');
  }
}

function assertPermission(actor: CourseActor, permission: string): void {
  if (!actor.permissions.includes(permission)) {
    throw new AppError('Bu amal uchun ruxsat yetarli emas.', 403, 'ACCESS_DENIED');
  }
}

function transitionPermission(current: CourseStatus, target: CourseStatus): string {
  if (
    target === CourseStatus.PUBLISHED ||
    (current === CourseStatus.PUBLISHED && target === CourseStatus.ARCHIVED)
  ) {
    return 'courses.publish';
  }

  if (current === CourseStatus.DRAFT && target === CourseStatus.IN_REVIEW) {
    return 'courses.submit_review';
  }

  return 'courses.update';
}

function publishValidationErrors(course: CourseRecord): string[] {
  const missingFields: string[] = [];

  if (!course.title.trim()) missingFields.push('title');
  if (!course.slug.trim()) missingFields.push('slug');
  if (!course.description?.trim()) missingFields.push('description');
  if (!course.level) missingFields.push('level');
  if (!course.teacher) missingFields.push('teacherId');

  return missingFields;
}

function toPagination<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  return {
    items,
    pagination: {
      page,
      pageSize,
      totalItems: total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export interface CourseManagementUseCases {
  list(query: CourseListQuery, actor: CourseActor): Promise<PaginatedResult<CourseRecord>>;
  statistics(actor: CourseActor): Promise<CourseStatistics>;
  getById(courseId: string, actor: CourseActor): Promise<CourseRecord>;
  create(
    input: CreateCourseInput,
    actor: CourseActor,
    context: CourseAuditContext,
  ): Promise<CourseRecord>;
  update(
    courseId: string,
    input: UpdateCourseInput,
    actor: CourseActor,
    context: CourseAuditContext,
  ): Promise<CourseRecord>;
  updateStatus(
    courseId: string,
    targetStatus: CourseStatus,
    actor: CourseActor,
    context: CourseAuditContext,
  ): Promise<CourseRecord>;
  assignTeacher(
    courseId: string,
    teacherId: string | null,
    actor: CourseActor,
    context: CourseAuditContext,
  ): Promise<CourseRecord>;
  delete(courseId: string, actor: CourseActor, context: CourseAuditContext): Promise<void>;
  restore(courseId: string, actor: CourseActor, context: CourseAuditContext): Promise<CourseRecord>;
  listCatalog(query: CatalogCourseListQuery): Promise<PaginatedResult<CatalogCourse>>;
  getCatalogBySlug(slug: string): Promise<CatalogCourse>;
}

export class CourseService implements CourseManagementUseCases {
  constructor(private readonly repository: CourseRepository) {}

  async list(query: CourseListQuery, actor: CourseActor): Promise<PaginatedResult<CourseRecord>> {
    const scopedTeacherId = isAdministrator(actor) ? undefined : actor.userId;
    const result = await this.repository.list(query, scopedTeacherId);
    return toPagination(result.items, result.total, query.page, query.pageSize);
  }

  statistics(actor: CourseActor): Promise<CourseStatistics> {
    if (!isAdministrator(actor)) {
      throw new AppError('Bu amal uchun ruxsat yetarli emas.', 403, 'ACCESS_DENIED');
    }

    assertPermission(actor, 'courses.view_statistics');
    return this.repository.statistics();
  }

  async getById(courseId: string, actor: CourseActor): Promise<CourseRecord> {
    const course = await this.repository.findById(courseId);

    if (!course) {
      throw courseNotFound();
    }

    assertTeacherScope(actor, course);
    return course;
  }

  async create(
    input: CreateCourseInput,
    actor: CourseActor,
    context: CourseAuditContext,
  ): Promise<CourseRecord> {
    const administrator = isAdministrator(actor);
    let teacherId = input.teacherId;

    if (!administrator) {
      if (teacherId && teacherId !== actor.userId) {
        throw new AppError(
          'O‘qituvchi kursni faqat o‘ziga biriktirib yaratishi mumkin.',
          403,
          'COURSE_TEACHER_ASSIGNMENT_DENIED',
        );
      }

      teacherId = actor.userId;
    } else if (teacherId) {
      assertPermission(actor, 'courses.assign_teacher');
    }

    if (teacherId && !(await this.repository.isEligibleTeacher(teacherId))) {
      throw new AppError(
        'Tanlangan foydalanuvchi faol o‘qituvchi emas.',
        422,
        'INVALID_COURSE_TEACHER',
      );
    }

    const slug = input.slug ?? generateCourseSlug(input.title);

    if (!courseSlugSchema.safeParse(slug).success) {
      throw new AppError('Kurs nomidan yaroqli slug yaratib bo‘lmadi.', 422, 'INVALID_COURSE_SLUG');
    }

    try {
      return await this.repository.create(
        {
          title: input.title,
          slug,
          ...(input.shortDescription !== undefined
            ? { shortDescription: input.shortDescription }
            : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.coverImageUrl !== undefined ? { coverImageUrl: input.coverImageUrl } : {}),
          contentLanguage: input.contentLanguage,
          ...(input.level !== undefined ? { level: input.level } : {}),
          ...(teacherId ? { teacherId } : {}),
          ...(input.estimatedDurationMinutes !== undefined
            ? { estimatedDurationMinutes: input.estimatedDurationMinutes }
            : {}),
          sortOrder: input.sortOrder,
          isFeatured: input.isFeatured,
          createdByUserId: actor.userId,
        },
        context,
      );
    } catch (error: unknown) {
      if (error instanceof CourseSlugConflictError) {
        throw slugConflict();
      }

      throw error;
    }
  }

  async update(
    courseId: string,
    input: UpdateCourseInput,
    actor: CourseActor,
    context: CourseAuditContext,
  ): Promise<CourseRecord> {
    const course = await this.getById(courseId, actor);

    if (course.deletedAt) {
      throw courseDeleted();
    }

    if (course.status === CourseStatus.PUBLISHED || course.status === CourseStatus.ARCHIVED) {
      throw new AppError(
        'Nashr qilingan yoki arxivlangan kursni tahrirlashdan oldin DRAFT holatiga qaytaring.',
        409,
        'COURSE_NOT_EDITABLE',
      );
    }

    try {
      const updated = await this.repository.update(courseId, input, context);

      if (!updated) {
        throw courseNotFound();
      }

      return updated;
    } catch (error: unknown) {
      if (error instanceof CourseSlugConflictError) {
        throw slugConflict();
      }

      throw error;
    }
  }

  async updateStatus(
    courseId: string,
    targetStatus: CourseStatus,
    actor: CourseActor,
    context: CourseAuditContext,
  ): Promise<CourseRecord> {
    const course = await this.getById(courseId, actor);

    if (course.deletedAt) {
      throw courseDeleted();
    }

    if (!validTransitions[course.status].includes(targetStatus)) {
      throw new AppError(
        `${course.status} holatidan ${targetStatus} holatiga o‘tish mumkin emas.`,
        409,
        'INVALID_COURSE_STATUS_TRANSITION',
      );
    }

    assertPermission(actor, transitionPermission(course.status, targetStatus));

    if (targetStatus === CourseStatus.PUBLISHED) {
      const missingFields = publishValidationErrors(course);

      if (missingFields.length > 0) {
        throw new AppError(
          'Kursni nashr qilish uchun majburiy ma’lumotlarni to‘ldiring.',
          422,
          'COURSE_NOT_READY_TO_PUBLISH',
          { missingFields },
        );
      }
    }

    const updated = await this.repository.updateStatus(courseId, targetStatus, context);

    if (!updated) {
      throw courseNotFound();
    }

    return updated;
  }

  async assignTeacher(
    courseId: string,
    teacherId: string | null,
    actor: CourseActor,
    context: CourseAuditContext,
  ): Promise<CourseRecord> {
    if (!isAdministrator(actor)) {
      throw new AppError('Bu amal uchun ruxsat yetarli emas.', 403, 'ACCESS_DENIED');
    }

    assertPermission(actor, 'courses.assign_teacher');
    const course = await this.repository.findById(courseId);

    if (!course) {
      throw courseNotFound();
    }

    if (course.deletedAt) {
      throw courseDeleted();
    }

    if (teacherId && !(await this.repository.isEligibleTeacher(teacherId))) {
      throw new AppError(
        'Tanlangan foydalanuvchi faol o‘qituvchi emas.',
        422,
        'INVALID_COURSE_TEACHER',
      );
    }

    if (course.teacher?.id === teacherId) {
      return course;
    }

    const updated = await this.repository.assignTeacher(courseId, teacherId, context);

    if (!updated) {
      throw courseNotFound();
    }

    return updated;
  }

  async delete(courseId: string, actor: CourseActor, context: CourseAuditContext): Promise<void> {
    const course = await this.getById(courseId, actor);

    if (course.deletedAt) {
      return;
    }

    const deleted = await this.repository.softDelete(courseId, context);

    if (!deleted) {
      throw courseNotFound();
    }
  }

  async restore(
    courseId: string,
    actor: CourseActor,
    context: CourseAuditContext,
  ): Promise<CourseRecord> {
    const course = await this.getById(courseId, actor);

    if (!course.deletedAt) {
      throw new AppError('Faqat o‘chirilgan kursni tiklash mumkin.', 409, 'COURSE_NOT_DELETED');
    }

    const restored = await this.repository.restore(courseId, context);

    if (!restored) {
      throw courseNotFound();
    }

    return restored;
  }

  async listCatalog(query: CatalogCourseListQuery): Promise<PaginatedResult<CatalogCourse>> {
    const result = await this.repository.listCatalog(query);
    return toPagination(result.items, result.total, query.page, query.pageSize);
  }

  async getCatalogBySlug(slug: string): Promise<CatalogCourse> {
    const course = await this.repository.findCatalogBySlug(slug);

    if (!course) {
      throw courseNotFound();
    }

    return course;
  }
}
