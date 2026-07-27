import { LessonStatus, Prisma, type LessonType, type PrismaClient } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import { bumpPublishedCourseCurriculumVersion } from '../progress-tracking/curriculum-version.repository.js';
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
} from './lesson-management.types.js';

const POSTGRES_INTEGER_MAX = 2_147_483_647;
const personSelect = {
  id: true,
  firstName: true,
  lastName: true,
  displayName: true,
} satisfies Prisma.UserSelect;
const lessonSelect = {
  id: true,
  courseId: true,
  title: true,
  slug: true,
  summary: true,
  content: true,
  lessonType: true,
  position: true,
  durationMinutes: true,
  isPreview: true,
  status: true,
  publishedAt: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  course: { select: { id: true, title: true, slug: true } },
  section: {
    select: {
      id: true,
      title: true,
      position: true,
      isPublished: true,
      deletedAt: true,
    },
  },
  createdBy: { select: personSelect },
  teacher: { select: personSelect },
} satisfies Prisma.LessonSelect;
type LessonPayload = Prisma.LessonGetPayload<{ select: typeof lessonSelect }>;

export class SectionNotEmptyError extends Error {}
export class LessonSlugConflictError extends Error {}
export class ContentPositionCapacityError extends Error {}

function auditFields(context: ContentAuditContext) {
  return {
    actorUserId: context.actorUserId,
    ...(context.requestCorrelationId ? { requestCorrelationId: context.requestCorrelationId } : {}),
    ...(context.ipHash ? { ipHash: context.ipHash } : {}),
    ...(context.userAgentSummary ? { userAgentSummary: context.userAgentSummary } : {}),
  };
}

function sectionSummary(section: {
  title: string;
  position: number;
  isPublished: boolean;
  deletedAt: Date | null;
}): Prisma.InputJsonObject {
  return {
    title: section.title,
    position: section.position,
    isPublished: section.isPublished,
    deletedAt: section.deletedAt?.toISOString() ?? null,
  };
}

function lessonSummary(lesson: LessonPayload): Prisma.InputJsonObject {
  return {
    title: lesson.title,
    slug: lesson.slug,
    sectionId: lesson.section.id,
    lessonType: lesson.lessonType,
    position: lesson.position,
    durationMinutes: lesson.durationMinutes,
    isPreview: lesson.isPreview,
    status: lesson.status,
    teacherId: lesson.teacher?.id ?? null,
    publishedAt: lesson.publishedAt?.toISOString() ?? null,
    deletedAt: lesson.deletedAt?.toISOString() ?? null,
  };
}

function mapLesson(lesson: LessonPayload): LessonRecord {
  return lesson;
}

function isUniqueError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

async function shiftSectionPositionsUp(
  transaction: Prisma.TransactionClient,
  courseId: string,
  startPosition: number,
  endPosition?: number,
): Promise<void> {
  const sections = await transaction.courseSection.findMany({
    where: {
      courseId,
      deletedAt: null,
      position: {
        gte: startPosition,
        ...(endPosition !== undefined ? { lte: endPosition } : {}),
      },
    },
    select: { id: true, position: true },
    orderBy: { position: 'desc' },
  });

  for (const section of sections) {
    if (section.position === POSTGRES_INTEGER_MAX) {
      throw new ContentPositionCapacityError();
    }
    await transaction.courseSection.update({
      where: { id: section.id },
      data: { position: section.position + 1 },
    });
  }
}

async function shiftSectionPositionsDown(
  transaction: Prisma.TransactionClient,
  courseId: string,
  startPosition: number,
  endPosition?: number,
): Promise<void> {
  const sections = await transaction.courseSection.findMany({
    where: {
      courseId,
      deletedAt: null,
      position: {
        gt: startPosition,
        ...(endPosition !== undefined ? { lte: endPosition } : {}),
      },
    },
    select: { id: true, position: true },
    orderBy: { position: 'asc' },
  });

  for (const section of sections) {
    await transaction.courseSection.update({
      where: { id: section.id },
      data: { position: section.position - 1 },
    });
  }
}

async function shiftLessonPositionsUp(
  transaction: Prisma.TransactionClient,
  sectionId: string,
  startPosition: number,
  endPosition?: number,
): Promise<void> {
  const lessons = await transaction.lesson.findMany({
    where: {
      sectionId,
      deletedAt: null,
      position: {
        gte: startPosition,
        ...(endPosition !== undefined ? { lte: endPosition } : {}),
      },
    },
    select: { id: true, position: true },
    orderBy: { position: 'desc' },
  });

  for (const lesson of lessons) {
    if (lesson.position === POSTGRES_INTEGER_MAX) {
      throw new ContentPositionCapacityError();
    }
    await transaction.lesson.update({
      where: { id: lesson.id },
      data: { position: lesson.position + 1 },
    });
  }
}

async function shiftLessonPositionsDown(
  transaction: Prisma.TransactionClient,
  sectionId: string,
  startPosition: number,
  endPosition?: number,
): Promise<void> {
  const lessons = await transaction.lesson.findMany({
    where: {
      sectionId,
      deletedAt: null,
      position: {
        gt: startPosition,
        ...(endPosition !== undefined ? { lte: endPosition } : {}),
      },
    },
    select: { id: true, position: true },
    orderBy: { position: 'asc' },
  });

  for (const lesson of lessons) {
    await transaction.lesson.update({
      where: { id: lesson.id },
      data: { position: lesson.position - 1 },
    });
  }
}

export interface LessonManagementRepository {
  listSections(courseId: string): Promise<CourseSectionRecord[]>;
  findSection(courseId: string, sectionId: string): Promise<CourseSectionDetail | null>;
  createSection(
    courseId: string,
    data: CreateSectionData,
    context: ContentAuditContext,
  ): Promise<CourseSectionRecord>;
  updateSection(
    courseId: string,
    sectionId: string,
    data: UpdateSectionData,
    context: ContentAuditContext,
  ): Promise<CourseSectionRecord | null>;
  reorderSection(
    courseId: string,
    sectionId: string,
    position: number,
    context: ContentAuditContext,
  ): Promise<CourseSectionRecord | null>;
  deleteSection(
    courseId: string,
    sectionId: string,
    context: ContentAuditContext,
  ): Promise<CourseSectionRecord | null>;
  restoreSection(
    courseId: string,
    sectionId: string,
    context: ContentAuditContext,
  ): Promise<CourseSectionRecord | null>;
  listLessons(
    courseId: string,
    query: LessonListQuery,
  ): Promise<{ items: LessonRecord[]; total: number }>;
  findLesson(courseId: string, lessonId: string): Promise<LessonRecord | null>;
  createLesson(
    courseId: string,
    data: CreateLessonData,
    context: ContentAuditContext,
  ): Promise<LessonRecord>;
  updateLesson(
    courseId: string,
    lessonId: string,
    data: UpdateLessonData,
    context: ContentAuditContext,
  ): Promise<LessonRecord | null>;
  updateLessonStatus(
    courseId: string,
    lessonId: string,
    status: LessonStatus,
    context: ContentAuditContext,
  ): Promise<LessonRecord | null>;
  assignLessonTeacher(
    courseId: string,
    lessonId: string,
    teacherId: string | null,
    context: ContentAuditContext,
  ): Promise<LessonRecord | null>;
  reorderLesson(
    courseId: string,
    lessonId: string,
    sectionId: string,
    position: number,
    context: ContentAuditContext,
  ): Promise<LessonRecord | null>;
  deleteLesson(
    courseId: string,
    lessonId: string,
    context: ContentAuditContext,
  ): Promise<LessonRecord | null>;
  restoreLesson(
    courseId: string,
    lessonId: string,
    context: ContentAuditContext,
  ): Promise<LessonRecord | null>;
  lessonStatistics(courseId: string): Promise<LessonStatistics>;
  catalogCurriculum(courseSlug: string): Promise<CatalogCurriculum | null>;
  catalogLesson(courseSlug: string, lessonSlug: string): Promise<CatalogLesson | null>;
}

export class PrismaLessonManagementRepository implements LessonManagementRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async listSections(courseId: string): Promise<CourseSectionRecord[]> {
    const sections = await this.client.courseSection.findMany({
      where: { courseId, deletedAt: null },
      include: { _count: { select: { lessons: { where: { deletedAt: null } } } } },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });
    return sections.map(({ _count, ...section }) => ({ ...section, lessonCount: _count.lessons }));
  }

  async findSection(courseId: string, sectionId: string): Promise<CourseSectionDetail | null> {
    const section = await this.client.courseSection.findFirst({
      where: { id: sectionId, courseId },
      include: {
        lessons: {
          where: { deletedAt: null },
          select: {
            id: true,
            title: true,
            slug: true,
            lessonType: true,
            position: true,
            durationMinutes: true,
            isPreview: true,
            status: true,
          },
          orderBy: [{ position: 'asc' }, { id: 'asc' }],
        },
        _count: { select: { lessons: { where: { deletedAt: null } } } },
      },
    });
    if (!section) return null;
    const { _count, lessons, ...record } = section;
    return { ...record, lessonCount: _count.lessons, lessons };
  }

  async createSection(
    courseId: string,
    data: CreateSectionData,
    context: ContentAuditContext,
  ): Promise<CourseSectionRecord> {
    return this.client.$transaction(
      async (tx) => {
        const count = await tx.courseSection.count({ where: { courseId, deletedAt: null } });
        const position = Math.min(data.position ?? count + 1, count + 1);
        await shiftSectionPositionsUp(tx, courseId, position);
        const section = await tx.courseSection.create({
          data: {
            courseId,
            title: data.title,
            ...(data.description !== undefined ? { description: data.description } : {}),
            position,
            createdById: data.createdById,
          },
        });
        await tx.auditLog.create({
          data: {
            ...auditFields(context),
            action: 'SECTION_CREATED',
            subjectType: 'course_section',
            subjectId: section.id,
            afterSummary: sectionSummary(section),
            metadata: { courseId },
          },
        });
        return { ...section, lessonCount: 0 };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async updateSection(
    courseId: string,
    sectionId: string,
    data: UpdateSectionData,
    context: ContentAuditContext,
  ): Promise<CourseSectionRecord | null> {
    return this.client.$transaction(async (tx) => {
      const before = await tx.courseSection.findFirst({
        where: { id: sectionId, courseId },
        include: { _count: { select: { lessons: { where: { deletedAt: null } } } } },
      });
      if (!before) return null;
      const updated = await tx.courseSection.update({
        where: { id: sectionId },
        data: {
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.isPublished !== undefined ? { isPublished: data.isPublished } : {}),
        },
      });
      if (
        data.isPublished !== undefined &&
        data.isPublished !== before.isPublished &&
        before.deletedAt === null
      ) {
        await bumpPublishedCourseCurriculumVersion(tx, courseId);
      }
      await tx.auditLog.create({
        data: {
          ...auditFields(context),
          action:
            data.isPublished === true && !before.isPublished
              ? 'SECTION_PUBLISHED'
              : 'SECTION_UPDATED',
          subjectType: 'course_section',
          subjectId: sectionId,
          beforeSummary: sectionSummary(before),
          afterSummary: sectionSummary(updated),
          metadata: { courseId },
        },
      });
      return { ...updated, lessonCount: before._count.lessons };
    });
  }

  async reorderSection(
    courseId: string,
    sectionId: string,
    requested: number,
    context: ContentAuditContext,
  ): Promise<CourseSectionRecord | null> {
    return this.client.$transaction(
      async (tx) => {
        const section = await tx.courseSection.findFirst({
          where: { id: sectionId, courseId, deletedAt: null },
          include: { _count: { select: { lessons: { where: { deletedAt: null } } } } },
        });
        if (!section) return null;
        const count = await tx.courseSection.count({ where: { courseId, deletedAt: null } });
        const position = Math.min(requested, count);
        if (position !== section.position) {
          await tx.courseSection.update({
            where: { id: sectionId },
            data: { deletedAt: new Date() },
          });
          if (position < section.position) {
            await shiftSectionPositionsUp(tx, courseId, position, section.position - 1);
          } else {
            await shiftSectionPositionsDown(tx, courseId, section.position, position);
          }
          await tx.courseSection.update({
            where: { id: sectionId },
            data: { position, deletedAt: null },
          });
          if (section.isPublished) {
            await bumpPublishedCourseCurriculumVersion(tx, courseId);
          }
        }
        const updated = await tx.courseSection.findUniqueOrThrow({ where: { id: sectionId } });
        await tx.auditLog.create({
          data: {
            ...auditFields(context),
            action: 'SECTION_REORDERED',
            subjectType: 'course_section',
            subjectId: sectionId,
            beforeSummary: { position: section.position },
            afterSummary: { position },
            metadata: { courseId },
          },
        });
        return { ...updated, lessonCount: section._count.lessons };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async deleteSection(
    courseId: string,
    sectionId: string,
    context: ContentAuditContext,
  ): Promise<CourseSectionRecord | null> {
    return this.client.$transaction(
      async (tx) => {
        const section = await tx.courseSection.findFirst({
          where: { id: sectionId, courseId },
          include: { _count: { select: { lessons: { where: { deletedAt: null } } } } },
        });
        if (!section) return null;
        if (section._count.lessons > 0) throw new SectionNotEmptyError();
        if (section.deletedAt) return { ...section, lessonCount: 0 };
        const deleted = await tx.courseSection.update({
          where: { id: sectionId },
          data: { deletedAt: new Date(), isPublished: false },
        });
        if (section.isPublished) {
          await bumpPublishedCourseCurriculumVersion(tx, courseId);
        }
        await shiftSectionPositionsDown(tx, courseId, section.position);
        await tx.auditLog.create({
          data: {
            ...auditFields(context),
            action: 'SECTION_DELETED',
            subjectType: 'course_section',
            subjectId: sectionId,
            beforeSummary: sectionSummary(section),
            afterSummary: sectionSummary(deleted),
            metadata: { courseId },
          },
        });
        return { ...deleted, lessonCount: 0 };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async restoreSection(
    courseId: string,
    sectionId: string,
    context: ContentAuditContext,
  ): Promise<CourseSectionRecord | null> {
    return this.client.$transaction(
      async (tx) => {
        const section = await tx.courseSection.findFirst({
          where: { id: sectionId, courseId },
          include: { _count: { select: { lessons: { where: { deletedAt: null } } } } },
        });
        if (!section) return null;
        const count = await tx.courseSection.count({ where: { courseId, deletedAt: null } });
        const position = Math.min(section.position, count + 1);
        await shiftSectionPositionsUp(tx, courseId, position);
        const restored = await tx.courseSection.update({
          where: { id: sectionId },
          data: { deletedAt: null, isPublished: false, position },
        });
        await tx.auditLog.create({
          data: {
            ...auditFields(context),
            action: 'SECTION_RESTORED',
            subjectType: 'course_section',
            subjectId: sectionId,
            beforeSummary: sectionSummary(section),
            afterSummary: sectionSummary(restored),
            metadata: { courseId },
          },
        });
        return { ...restored, lessonCount: section._count.lessons };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async listLessons(
    courseId: string,
    query: LessonListQuery,
  ): Promise<{ items: LessonRecord[]; total: number }> {
    const where: Prisma.LessonWhereInput = {
      courseId,
      ...(query.includeDeleted ? {} : { deletedAt: null }),
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.lessonType ? { lessonType: query.lessonType } : {}),
      ...(query.teacherId ? { teacherId: query.teacherId } : {}),
      ...(query.isPreview !== undefined ? { isPreview: query.isPreview } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
              { summary: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [lessons, total] = await this.client.$transaction([
      this.client.lesson.findMany({
        where,
        select: lessonSelect,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: [{ [query.sortBy]: query.sortDirection }, { id: query.sortDirection }],
      }),
      this.client.lesson.count({ where }),
    ]);
    return { items: lessons.map(mapLesson), total };
  }

  async findLesson(courseId: string, lessonId: string): Promise<LessonRecord | null> {
    const lesson = await this.client.lesson.findFirst({
      where: { id: lessonId, courseId },
      select: lessonSelect,
    });
    return lesson ? mapLesson(lesson) : null;
  }

  async createLesson(
    courseId: string,
    data: CreateLessonData,
    context: ContentAuditContext,
  ): Promise<LessonRecord> {
    try {
      return await this.client.$transaction(
        async (tx) => {
          const count = await tx.lesson.count({
            where: { sectionId: data.sectionId, deletedAt: null },
          });
          const position = Math.min(data.position ?? count + 1, count + 1);
          await shiftLessonPositionsUp(tx, data.sectionId, position);
          const lesson = await tx.lesson.create({
            data: {
              courseId,
              sectionId: data.sectionId,
              title: data.title,
              slug: data.slug,
              ...(data.summary !== undefined ? { summary: data.summary } : {}),
              ...(data.content !== undefined ? { content: data.content } : {}),
              lessonType: data.lessonType,
              position,
              ...(data.durationMinutes !== undefined
                ? { durationMinutes: data.durationMinutes }
                : {}),
              isPreview: data.isPreview,
              createdById: data.createdById,
              ...(data.teacherId !== undefined ? { teacherId: data.teacherId } : {}),
            },
            select: lessonSelect,
          });
          await tx.auditLog.create({
            data: {
              ...auditFields(context),
              action: 'LESSON_CREATED',
              subjectType: 'lesson',
              subjectId: lesson.id,
              afterSummary: lessonSummary(lesson),
              metadata: { courseId },
            },
          });
          return mapLesson(lesson);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error: unknown) {
      if (isUniqueError(error)) throw new LessonSlugConflictError();
      throw error;
    }
  }

  async updateLesson(
    courseId: string,
    lessonId: string,
    data: UpdateLessonData,
    context: ContentAuditContext,
  ): Promise<LessonRecord | null> {
    try {
      return await this.client.$transaction(async (tx) => {
        const before = await tx.lesson.findFirst({
          where: { id: lessonId, courseId },
          select: lessonSelect,
        });
        if (!before) return null;
        const updated = await tx.lesson.update({
          where: { id: lessonId },
          data: {
            ...(data.title !== undefined ? { title: data.title } : {}),
            ...(data.slug !== undefined ? { slug: data.slug } : {}),
            ...(data.summary !== undefined ? { summary: data.summary } : {}),
            ...(data.content !== undefined ? { content: data.content } : {}),
            ...(data.lessonType !== undefined ? { lessonType: data.lessonType } : {}),
            ...(data.durationMinutes !== undefined
              ? { durationMinutes: data.durationMinutes }
              : {}),
            ...(data.isPreview !== undefined ? { isPreview: data.isPreview } : {}),
          },
          select: lessonSelect,
        });
        await tx.auditLog.create({
          data: {
            ...auditFields(context),
            action: 'LESSON_UPDATED',
            subjectType: 'lesson',
            subjectId: lessonId,
            beforeSummary: lessonSummary(before),
            afterSummary: lessonSummary(updated),
            metadata: { courseId },
          },
        });
        return mapLesson(updated);
      });
    } catch (error: unknown) {
      if (isUniqueError(error)) throw new LessonSlugConflictError();
      throw error;
    }
  }

  async updateLessonStatus(
    courseId: string,
    lessonId: string,
    status: LessonStatus,
    context: ContentAuditContext,
  ): Promise<LessonRecord | null> {
    return this.client.$transaction(async (tx) => {
      const before = await tx.lesson.findFirst({
        where: { id: lessonId, courseId },
        select: lessonSelect,
      });
      if (!before) return null;
      const now = new Date();
      const dates =
        status === LessonStatus.PUBLISHED
          ? { publishedAt: now, archivedAt: null }
          : status === LessonStatus.ARCHIVED
            ? { archivedAt: now }
            : status === LessonStatus.DRAFT && before.status === LessonStatus.ARCHIVED
              ? { publishedAt: null, archivedAt: null }
              : {};
      const updated = await tx.lesson.update({
        where: { id: lessonId },
        data: { status, ...dates },
        select: lessonSelect,
      });
      if (
        before.status !== status &&
        (before.status === LessonStatus.PUBLISHED || status === LessonStatus.PUBLISHED) &&
        before.deletedAt === null &&
        before.section.isPublished &&
        before.section.deletedAt === null
      ) {
        await bumpPublishedCourseCurriculumVersion(tx, courseId);
      }
      await tx.auditLog.create({
        data: {
          ...auditFields(context),
          action: 'LESSON_STATUS_CHANGED',
          subjectType: 'lesson',
          subjectId: lessonId,
          beforeSummary: lessonSummary(before),
          afterSummary: lessonSummary(updated),
          metadata: { courseId },
        },
      });
      return mapLesson(updated);
    });
  }

  async assignLessonTeacher(
    courseId: string,
    lessonId: string,
    teacherId: string | null,
    context: ContentAuditContext,
  ): Promise<LessonRecord | null> {
    return this.client.$transaction(async (tx) => {
      const before = await tx.lesson.findFirst({
        where: { id: lessonId, courseId },
        select: lessonSelect,
      });
      if (!before) return null;
      const updated = await tx.lesson.update({
        where: { id: lessonId },
        data: { teacherId },
        select: lessonSelect,
      });
      await tx.auditLog.create({
        data: {
          ...auditFields(context),
          action: 'LESSON_TEACHER_ASSIGNED',
          subjectType: 'lesson',
          subjectId: lessonId,
          beforeSummary: lessonSummary(before),
          afterSummary: lessonSummary(updated),
          metadata: { courseId },
        },
      });
      return mapLesson(updated);
    });
  }

  async reorderLesson(
    courseId: string,
    lessonId: string,
    targetSectionId: string,
    requested: number,
    context: ContentAuditContext,
  ): Promise<LessonRecord | null> {
    return this.client.$transaction(
      async (tx) => {
        const before = await tx.lesson.findFirst({
          where: { id: lessonId, courseId, deletedAt: null },
          select: lessonSelect,
        });
        if (!before) return null;
        await tx.lesson.update({
          where: { id: lessonId },
          data: { deletedAt: new Date() },
        });
        await shiftLessonPositionsDown(tx, before.section.id, before.position);
        const count = await tx.lesson.count({
          where: { sectionId: targetSectionId, deletedAt: null },
        });
        const position = Math.min(requested, count + 1);
        await shiftLessonPositionsUp(tx, targetSectionId, position);
        const updated = await tx.lesson.update({
          where: { id: lessonId },
          data: { sectionId: targetSectionId, position, deletedAt: null },
          select: lessonSelect,
        });
        if (
          before.status === LessonStatus.PUBLISHED &&
          (before.section.isPublished || updated.section.isPublished) &&
          (before.section.id !== updated.section.id || before.position !== updated.position)
        ) {
          await bumpPublishedCourseCurriculumVersion(tx, courseId);
        }
        await tx.auditLog.create({
          data: {
            ...auditFields(context),
            action: 'LESSON_REORDERED',
            subjectType: 'lesson',
            subjectId: lessonId,
            beforeSummary: lessonSummary(before),
            afterSummary: lessonSummary(updated),
            metadata: { courseId },
          },
        });
        return mapLesson(updated);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async deleteLesson(
    courseId: string,
    lessonId: string,
    context: ContentAuditContext,
  ): Promise<LessonRecord | null> {
    return this.client.$transaction(
      async (tx) => {
        const before = await tx.lesson.findFirst({
          where: { id: lessonId, courseId },
          select: lessonSelect,
        });
        if (!before) return null;
        if (before.deletedAt) return mapLesson(before);
        const updated = await tx.lesson.update({
          where: { id: lessonId },
          data: { deletedAt: new Date() },
          select: lessonSelect,
        });
        if (before.status === LessonStatus.PUBLISHED && before.section.isPublished) {
          await bumpPublishedCourseCurriculumVersion(tx, courseId);
        }
        await shiftLessonPositionsDown(tx, before.section.id, before.position);
        await tx.auditLog.create({
          data: {
            ...auditFields(context),
            action: 'LESSON_DELETED',
            subjectType: 'lesson',
            subjectId: lessonId,
            beforeSummary: lessonSummary(before),
            afterSummary: lessonSummary(updated),
            metadata: { courseId },
          },
        });
        return mapLesson(updated);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async restoreLesson(
    courseId: string,
    lessonId: string,
    context: ContentAuditContext,
  ): Promise<LessonRecord | null> {
    return this.client.$transaction(
      async (tx) => {
        const before = await tx.lesson.findFirst({
          where: { id: lessonId, courseId },
          select: lessonSelect,
        });
        if (!before) return null;
        const count = await tx.lesson.count({
          where: { sectionId: before.section.id, deletedAt: null },
        });
        const position = Math.min(before.position, count + 1);
        await shiftLessonPositionsUp(tx, before.section.id, position);
        const updated = await tx.lesson.update({
          where: { id: lessonId },
          data: {
            deletedAt: null,
            status: LessonStatus.DRAFT,
            publishedAt: null,
            archivedAt: null,
            position,
          },
          select: lessonSelect,
        });
        await tx.auditLog.create({
          data: {
            ...auditFields(context),
            action: 'LESSON_RESTORED',
            subjectType: 'lesson',
            subjectId: lessonId,
            beforeSummary: lessonSummary(before),
            afterSummary: lessonSummary(updated),
            metadata: { courseId },
          },
        });
        return mapLesson(updated);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async lessonStatistics(courseId: string): Promise<LessonStatistics> {
    const active = { courseId, deletedAt: null } satisfies Prisma.LessonWhereInput;
    const [total, draft, inReview, published, archived, deleted, preview] =
      await this.client.$transaction([
        this.client.lesson.count({ where: active }),
        this.client.lesson.count({ where: { ...active, status: LessonStatus.DRAFT } }),
        this.client.lesson.count({ where: { ...active, status: LessonStatus.IN_REVIEW } }),
        this.client.lesson.count({ where: { ...active, status: LessonStatus.PUBLISHED } }),
        this.client.lesson.count({ where: { ...active, status: LessonStatus.ARCHIVED } }),
        this.client.lesson.count({ where: { courseId, deletedAt: { not: null } } }),
        this.client.lesson.count({ where: { ...active, isPreview: true } }),
      ]);
    const grouped = await this.client.lesson.groupBy({
      by: ['lessonType'],
      where: active,
      orderBy: { lessonType: 'asc' },
      _count: { id: true },
    });
    const byType: Record<LessonType, number> = {
      TEXT: 0,
      VIDEO: 0,
      AUDIO: 0,
      PDF: 0,
      QUIZ: 0,
      ASSIGNMENT: 0,
      LIVE: 0,
    };
    for (const item of grouped) byType[item.lessonType] = item._count.id;
    return { total, draft, inReview, published, archived, deleted, preview, byType };
  }

  async catalogCurriculum(courseSlug: string): Promise<CatalogCurriculum | null> {
    return this.client.course
      .findFirst({
        where: { slug: courseSlug, status: 'PUBLISHED', deletedAt: null },
        select: {
          id: true,
          title: true,
          slug: true,
          sections: {
            where: { isPublished: true, deletedAt: null },
            orderBy: [{ position: 'asc' }, { id: 'asc' }],
            select: {
              id: true,
              title: true,
              description: true,
              position: true,
              lessons: {
                where: { status: LessonStatus.PUBLISHED, deletedAt: null },
                orderBy: [{ position: 'asc' }, { id: 'asc' }],
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  lessonType: true,
                  position: true,
                  durationMinutes: true,
                  isPreview: true,
                },
              },
            },
          },
        },
      })
      .then((course) =>
        course
          ? {
              course: { id: course.id, title: course.title, slug: course.slug },
              sections: course.sections,
            }
          : null,
      );
  }

  async catalogLesson(courseSlug: string, lessonSlug: string): Promise<CatalogLesson | null> {
    const lesson = await this.client.lesson.findFirst({
      where: {
        slug: lessonSlug,
        status: LessonStatus.PUBLISHED,
        deletedAt: null,
        course: { slug: courseSlug, status: 'PUBLISHED', deletedAt: null },
        section: { isPublished: true, deletedAt: null },
      },
      select: {
        id: true,
        courseId: true,
        title: true,
        slug: true,
        summary: true,
        content: true,
        lessonType: true,
        durationMinutes: true,
        isPreview: true,
        publishedAt: true,
        section: { select: { id: true, title: true } },
      },
    });
    return lesson?.publishedAt ? { ...lesson, publishedAt: lesson.publishedAt } : null;
  }
}
