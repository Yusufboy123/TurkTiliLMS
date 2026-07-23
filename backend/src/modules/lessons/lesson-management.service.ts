import { CourseStatus, LessonStatus, RoleCode } from '@prisma/client';
import { AppError } from '../../utils/app-error.js';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types.js';
import type { CourseRepository } from '../courses/course.repository.js';
import { courseSlugSchema } from '../courses/course.schemas.js';
import { generateCourseSlug } from '../courses/course.slug.js';
import type { CourseRecord } from '../courses/course.types.js';
import {
  LessonSlugConflictError,
  SectionNotEmptyError,
  type LessonManagementRepository,
} from './lesson-management.repository.js';
import type {
  CreateLessonInput,
  CreateSectionInput,
  UpdateLessonInput,
  UpdateSectionInput,
} from './lesson-management.schemas.js';
import type {
  CatalogCurriculum,
  CatalogLesson,
  ContentActor,
  ContentAuditContext,
  CourseSectionDetail,
  CourseSectionRecord,
  LessonListQuery,
  LessonPage,
  LessonRecord,
  LessonStatistics,
} from './lesson-management.types.js';

const lessonTransitions: Record<LessonStatus, LessonStatus[]> = {
  DRAFT: [LessonStatus.IN_REVIEW],
  IN_REVIEW: [LessonStatus.DRAFT, LessonStatus.PUBLISHED],
  PUBLISHED: [LessonStatus.ARCHIVED],
  ARCHIVED: [LessonStatus.DRAFT],
};

function isAdmin(actor: ContentActor): boolean {
  return actor.roles.includes(RoleCode.ADMIN);
}

function assertPermission(actor: ContentActor, permission: string): void {
  if (!actor.permissions.includes(permission)) {
    throw new AppError('Bu amal uchun ruxsat yetarli emas.', 403, 'ACCESS_DENIED');
  }
}

function assertCourseScope(actor: ContentActor, course: CourseRecord): void {
  if (!isAdmin(actor) && course.teacher?.id !== actor.userId) {
    throw new AppError('Bu kurs sizga biriktirilmagan.', 403, 'COURSE_SCOPE_DENIED');
  }
}

function sectionNotFound(): AppError {
  return new AppError('Kurs bo‘limi topilmadi.', 404, 'SECTION_NOT_FOUND');
}

function lessonNotFound(): AppError {
  return new AppError('Dars topilmadi.', 404, 'LESSON_NOT_FOUND');
}

export interface NonPreviewLessonAccessPolicy {
  canAccess(principal: AuthenticatedPrincipal, lesson: CatalogLesson): Promise<boolean>;
}

export class EnrollmentPendingLessonAccessPolicy implements NonPreviewLessonAccessPolicy {
  canAccess(): Promise<boolean> {
    return Promise.resolve(false);
  }
}

export class LessonManagementService {
  constructor(
    private readonly repository: LessonManagementRepository,
    private readonly courses: CourseRepository,
    private readonly accessPolicy: NonPreviewLessonAccessPolicy,
  ) {}

  private async managedCourse(courseId: string, actor: ContentActor): Promise<CourseRecord> {
    const course = await this.courses.findById(courseId);
    if (!course) throw new AppError('Kurs topilmadi.', 404, 'COURSE_NOT_FOUND');
    assertCourseScope(actor, course);
    if (course.deletedAt) {
      throw new AppError(
        'O‘chirilgan kurs tarkibini boshqarib bo‘lmaydi.',
        409,
        'COURSE_IS_DELETED',
      );
    }
    return course;
  }

  async listSections(courseId: string, actor: ContentActor): Promise<CourseSectionRecord[]> {
    await this.managedCourse(courseId, actor);
    return this.repository.listSections(courseId);
  }

  async sectionDetail(
    courseId: string,
    sectionId: string,
    actor: ContentActor,
  ): Promise<CourseSectionDetail> {
    await this.managedCourse(courseId, actor);
    const section = await this.repository.findSection(courseId, sectionId);
    if (!section) throw sectionNotFound();
    return section;
  }

  async createSection(
    courseId: string,
    input: CreateSectionInput,
    actor: ContentActor,
    context: ContentAuditContext,
  ): Promise<CourseSectionRecord> {
    await this.managedCourse(courseId, actor);
    return this.repository.createSection(
      courseId,
      {
        title: input.title,
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
        createdById: actor.userId,
      },
      context,
    );
  }

  async updateSection(
    courseId: string,
    sectionId: string,
    input: UpdateSectionInput,
    actor: ContentActor,
    context: ContentAuditContext,
  ): Promise<CourseSectionRecord> {
    const course = await this.managedCourse(courseId, actor);
    const section = await this.repository.findSection(courseId, sectionId);
    if (!section) throw sectionNotFound();
    if (section.deletedAt)
      throw new AppError('O‘chirilgan bo‘limni avval tiklang.', 409, 'SECTION_IS_DELETED');
    if (input.isPublished !== undefined && input.isPublished !== section.isPublished) {
      assertPermission(actor, 'sections.publish');
      if (input.isPublished && course.status !== CourseStatus.PUBLISHED) {
        throw new AppError(
          'Bo‘limni nashr qilish uchun kurs PUBLISHED holatida bo‘lishi kerak.',
          409,
          'COURSE_NOT_PUBLISHED',
        );
      }
    }
    const updated = await this.repository.updateSection(courseId, sectionId, input, context);
    if (!updated) throw sectionNotFound();
    return updated;
  }

  async reorderSection(
    courseId: string,
    sectionId: string,
    position: number,
    actor: ContentActor,
    context: ContentAuditContext,
  ): Promise<CourseSectionRecord> {
    await this.managedCourse(courseId, actor);
    const updated = await this.repository.reorderSection(courseId, sectionId, position, context);
    if (!updated) throw sectionNotFound();
    return updated;
  }

  async deleteSection(
    courseId: string,
    sectionId: string,
    actor: ContentActor,
    context: ContentAuditContext,
  ): Promise<void> {
    await this.managedCourse(courseId, actor);
    try {
      const deleted = await this.repository.deleteSection(courseId, sectionId, context);
      if (!deleted) throw sectionNotFound();
    } catch (error: unknown) {
      if (error instanceof SectionNotEmptyError) {
        throw new AppError(
          'Ichida faol darslar bor bo‘limni o‘chirib bo‘lmaydi. Avval darslarni ko‘chiring yoki o‘chiring.',
          409,
          'SECTION_NOT_EMPTY',
        );
      }
      throw error;
    }
  }

  async restoreSection(
    courseId: string,
    sectionId: string,
    actor: ContentActor,
    context: ContentAuditContext,
  ): Promise<CourseSectionRecord> {
    await this.managedCourse(courseId, actor);
    const current = await this.repository.findSection(courseId, sectionId);
    if (!current) throw sectionNotFound();
    if (!current.deletedAt)
      throw new AppError('Faqat o‘chirilgan bo‘limni tiklash mumkin.', 409, 'SECTION_NOT_DELETED');
    const restored = await this.repository.restoreSection(courseId, sectionId, context);
    if (!restored) throw sectionNotFound();
    return restored;
  }

  async listLessons(
    courseId: string,
    query: LessonListQuery,
    actor: ContentActor,
  ): Promise<LessonPage> {
    await this.managedCourse(courseId, actor);
    const result = await this.repository.listLessons(courseId, query);
    return {
      items: result.items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems: result.total,
        totalPages: Math.ceil(result.total / query.pageSize),
      },
    };
  }

  async lessonDetail(
    courseId: string,
    lessonId: string,
    actor: ContentActor,
  ): Promise<LessonRecord> {
    await this.managedCourse(courseId, actor);
    const lesson = await this.repository.findLesson(courseId, lessonId);
    if (!lesson) throw lessonNotFound();
    return lesson;
  }

  async createLesson(
    courseId: string,
    input: CreateLessonInput,
    actor: ContentActor,
    context: ContentAuditContext,
  ): Promise<LessonRecord> {
    await this.managedCourse(courseId, actor);
    const section = await this.repository.findSection(courseId, input.sectionId);
    if (!section) throw sectionNotFound();
    if (section.deletedAt)
      throw new AppError('O‘chirilgan bo‘limga dars qo‘shib bo‘lmaydi.', 409, 'SECTION_IS_DELETED');
    let teacherId = input.teacherId;
    if (!isAdmin(actor)) {
      if (teacherId && teacherId !== actor.userId)
        throw new AppError(
          'Darsni boshqa o‘qituvchiga biriktirib bo‘lmaydi.',
          403,
          'LESSON_TEACHER_ASSIGNMENT_DENIED',
        );
      teacherId = actor.userId;
    } else if (teacherId) {
      assertPermission(actor, 'lessons.assign_teacher');
    }
    if (teacherId && !(await this.courses.isEligibleTeacher(teacherId))) {
      throw new AppError(
        'Tanlangan foydalanuvchi faol o‘qituvchi emas.',
        422,
        'INVALID_LESSON_TEACHER',
      );
    }
    const slug = input.slug ?? generateCourseSlug(input.title);
    if (!courseSlugSchema.safeParse(slug).success)
      throw new AppError('Dars uchun yaroqli slug yaratib bo‘lmadi.', 422, 'INVALID_LESSON_SLUG');
    try {
      return await this.repository.createLesson(
        courseId,
        {
          sectionId: input.sectionId,
          title: input.title,
          slug,
          ...(input.summary !== undefined ? { summary: input.summary } : {}),
          ...(input.content !== undefined ? { content: input.content } : {}),
          lessonType: input.lessonType,
          ...(input.position !== undefined ? { position: input.position } : {}),
          ...(input.durationMinutes !== undefined
            ? { durationMinutes: input.durationMinutes }
            : {}),
          isPreview: input.isPreview,
          createdById: actor.userId,
          ...(teacherId ? { teacherId } : {}),
        },
        context,
      );
    } catch (error: unknown) {
      if (error instanceof LessonSlugConflictError)
        throw new AppError(
          'Bu slug kursdagi boshqa dars tomonidan ishlatilmoqda.',
          409,
          'LESSON_SLUG_CONFLICT',
        );
      throw error;
    }
  }

  async updateLesson(
    courseId: string,
    lessonId: string,
    input: UpdateLessonInput,
    actor: ContentActor,
    context: ContentAuditContext,
  ): Promise<LessonRecord> {
    const lesson = await this.lessonDetail(courseId, lessonId, actor);
    if (lesson.deletedAt)
      throw new AppError('O‘chirilgan darsni avval tiklang.', 409, 'LESSON_IS_DELETED');
    if (lesson.section.deletedAt)
      throw new AppError(
        'O‘chirilgan bo‘limdagi darsni boshqarib bo‘lmaydi.',
        409,
        'SECTION_IS_DELETED',
      );
    if (lesson.status === LessonStatus.PUBLISHED || lesson.status === LessonStatus.ARCHIVED) {
      throw new AppError(
        'Nashr qilingan yoki arxivlangan darsni avval DRAFT holatiga qaytaring.',
        409,
        'LESSON_NOT_EDITABLE',
      );
    }
    try {
      const updated = await this.repository.updateLesson(courseId, lessonId, input, context);
      if (!updated) throw lessonNotFound();
      return updated;
    } catch (error: unknown) {
      if (error instanceof LessonSlugConflictError)
        throw new AppError(
          'Bu slug kursdagi boshqa dars tomonidan ishlatilmoqda.',
          409,
          'LESSON_SLUG_CONFLICT',
        );
      throw error;
    }
  }

  async updateLessonStatus(
    courseId: string,
    lessonId: string,
    target: LessonStatus,
    actor: ContentActor,
    context: ContentAuditContext,
  ): Promise<LessonRecord> {
    const course = await this.managedCourse(courseId, actor);
    const lesson = await this.repository.findLesson(courseId, lessonId);
    if (!lesson) throw lessonNotFound();
    if (lesson.deletedAt || lesson.section.deletedAt)
      throw new AppError(
        'O‘chirilgan tarkib holatini o‘zgartirib bo‘lmaydi.',
        409,
        'CONTENT_IS_DELETED',
      );
    if (!lessonTransitions[lesson.status].includes(target))
      throw new AppError(
        `${lesson.status} holatidan ${target} holatiga o‘tish mumkin emas.`,
        409,
        'INVALID_LESSON_STATUS_TRANSITION',
      );
    const permission =
      target === LessonStatus.PUBLISHED || lesson.status === LessonStatus.PUBLISHED
        ? 'lessons.publish'
        : lesson.status === LessonStatus.DRAFT && target === LessonStatus.IN_REVIEW
          ? 'lessons.submit_review'
          : 'lessons.update';
    assertPermission(actor, permission);
    if (target === LessonStatus.PUBLISHED) {
      if (course.status !== CourseStatus.PUBLISHED)
        throw new AppError(
          'Darsni nashr qilish uchun kurs PUBLISHED holatida bo‘lishi kerak.',
          409,
          'COURSE_NOT_PUBLISHED',
        );
      if (!lesson.section.isPublished)
        throw new AppError(
          'Darsni nashr qilish uchun uning bo‘limi nashr qilingan bo‘lishi kerak.',
          409,
          'SECTION_NOT_PUBLISHED',
        );
    }
    const updated = await this.repository.updateLessonStatus(courseId, lessonId, target, context);
    if (!updated) throw lessonNotFound();
    return updated;
  }

  async assignLessonTeacher(
    courseId: string,
    lessonId: string,
    teacherId: string | null,
    actor: ContentActor,
    context: ContentAuditContext,
  ): Promise<LessonRecord> {
    if (!isAdmin(actor))
      throw new AppError('Bu amal uchun ruxsat yetarli emas.', 403, 'ACCESS_DENIED');
    assertPermission(actor, 'lessons.assign_teacher');
    const lesson = await this.lessonDetail(courseId, lessonId, actor);
    if (lesson.deletedAt)
      throw new AppError('O‘chirilgan darsni avval tiklang.', 409, 'LESSON_IS_DELETED');
    if (lesson.section.deletedAt)
      throw new AppError(
        'O‘chirilgan bo‘limdagi darsni boshqarib bo‘lmaydi.',
        409,
        'SECTION_IS_DELETED',
      );
    if (teacherId && !(await this.courses.isEligibleTeacher(teacherId)))
      throw new AppError(
        'Tanlangan foydalanuvchi faol o‘qituvchi emas.',
        422,
        'INVALID_LESSON_TEACHER',
      );
    const updated = await this.repository.assignLessonTeacher(
      courseId,
      lessonId,
      teacherId,
      context,
    );
    if (!updated) throw lessonNotFound();
    return updated;
  }

  async reorderLesson(
    courseId: string,
    lessonId: string,
    sectionId: string | undefined,
    position: number,
    actor: ContentActor,
    context: ContentAuditContext,
  ): Promise<LessonRecord> {
    const lesson = await this.lessonDetail(courseId, lessonId, actor);
    if (lesson.deletedAt)
      throw new AppError('O‘chirilgan darsni ko‘chirib bo‘lmaydi.', 409, 'LESSON_IS_DELETED');
    const targetSectionId = sectionId ?? lesson.section.id;
    const targetSection = await this.repository.findSection(courseId, targetSectionId);
    if (!targetSection) throw sectionNotFound();
    if (targetSection.deletedAt)
      throw new AppError(
        'Darsni o‘chirilgan bo‘limga ko‘chirib bo‘lmaydi.',
        409,
        'SECTION_IS_DELETED',
      );
    const updated = await this.repository.reorderLesson(
      courseId,
      lessonId,
      targetSectionId,
      position,
      context,
    );
    if (!updated) throw lessonNotFound();
    return updated;
  }

  async deleteLesson(
    courseId: string,
    lessonId: string,
    actor: ContentActor,
    context: ContentAuditContext,
  ): Promise<void> {
    const lesson = await this.lessonDetail(courseId, lessonId, actor);
    if (lesson.deletedAt) return;
    if (!(await this.repository.deleteLesson(courseId, lessonId, context))) throw lessonNotFound();
  }

  async restoreLesson(
    courseId: string,
    lessonId: string,
    actor: ContentActor,
    context: ContentAuditContext,
  ): Promise<LessonRecord> {
    const lesson = await this.lessonDetail(courseId, lessonId, actor);
    if (!lesson.deletedAt)
      throw new AppError('Faqat o‘chirilgan darsni tiklash mumkin.', 409, 'LESSON_NOT_DELETED');
    if (lesson.section.deletedAt)
      throw new AppError(
        'Darsni tiklashdan oldin uning bo‘limini tiklang.',
        409,
        'SECTION_IS_DELETED',
      );
    const restored = await this.repository.restoreLesson(courseId, lessonId, context);
    if (!restored) throw lessonNotFound();
    return restored;
  }

  async lessonStatistics(courseId: string, actor: ContentActor): Promise<LessonStatistics> {
    await this.managedCourse(courseId, actor);
    return this.repository.lessonStatistics(courseId);
  }

  async curriculum(courseSlug: string): Promise<CatalogCurriculum> {
    const result = await this.repository.catalogCurriculum(courseSlug);
    if (!result) throw new AppError('Kurs topilmadi.', 404, 'COURSE_NOT_FOUND');
    return result;
  }

  async catalogLesson(
    courseSlug: string,
    lessonSlug: string,
    principal: AuthenticatedPrincipal | null,
  ): Promise<CatalogLesson> {
    const lesson = await this.repository.catalogLesson(courseSlug, lessonSlug);
    if (!lesson) throw lessonNotFound();
    if (lesson.isPreview) return lesson;
    if (!principal)
      throw new AppError(
        'Ushbu dars uchun tizimga kirish talab qilinadi.',
        401,
        'LESSON_AUTHENTICATION_REQUIRED',
      );
    if (!(await this.accessPolicy.canAccess(principal, lesson))) {
      throw new AppError(
        'Ushbu darsga kirish uchun faol kurs yoziluvi talab qilinadi. Yoziluv tekshiruvi keyingi modulda ulanadi.',
        403,
        'LESSON_ENROLLMENT_REQUIRED',
      );
    }
    return lesson;
  }
}
