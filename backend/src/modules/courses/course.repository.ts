import {
  CourseStatus,
  Prisma,
  RoleCode,
  UserStatus,
  type CourseLevel,
  type PrismaClient,
} from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type {
  CatalogCourse,
  CatalogCourseListQuery,
  CourseAuditContext,
  CourseListQuery,
  CourseRecord,
  CourseStatistics,
  CreateCourseData,
  UpdateCourseData,
} from './course.types.js';

const teacherSelect = {
  id: true,
  firstName: true,
  lastName: true,
  displayName: true,
} satisfies Prisma.UserSelect;

const courseSelect = {
  id: true,
  title: true,
  slug: true,
  shortDescription: true,
  description: true,
  coverImageUrl: true,
  contentLanguage: true,
  level: true,
  status: true,
  createdByUserId: true,
  teacher: { select: teacherSelect },
  estimatedDurationMinutes: true,
  sortOrder: true,
  isFeatured: true,
  publishedAt: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.CourseSelect;

type CoursePayload = Prisma.CourseGetPayload<{ select: typeof courseSelect }>;

export class CourseSlugConflictError extends Error {
  constructor() {
    super('Course slug already exists.');
    this.name = 'CourseSlugConflictError';
  }
}

function mapCourse(course: CoursePayload): CourseRecord {
  return course;
}

function mapCatalogCourse(course: CoursePayload): CatalogCourse | null {
  if (!course.level || !course.teacher || !course.publishedAt) {
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

function auditFields(context: CourseAuditContext): {
  actorUserId: string;
  requestCorrelationId?: string;
  ipHash?: string;
  userAgentSummary?: string;
} {
  return {
    actorUserId: context.actorUserId,
    ...(context.requestCorrelationId ? { requestCorrelationId: context.requestCorrelationId } : {}),
    ...(context.ipHash ? { ipHash: context.ipHash } : {}),
    ...(context.userAgentSummary ? { userAgentSummary: context.userAgentSummary } : {}),
  };
}

function auditSummary(course: CourseRecord): Prisma.InputJsonObject {
  return {
    title: course.title,
    slug: course.slug,
    contentLanguage: course.contentLanguage,
    level: course.level,
    status: course.status,
    teacherId: course.teacher?.id ?? null,
    estimatedDurationMinutes: course.estimatedDurationMinutes,
    sortOrder: course.sortOrder,
    isFeatured: course.isFeatured,
    publishedAt: course.publishedAt?.toISOString() ?? null,
    archivedAt: course.archivedAt?.toISOString() ?? null,
    deletedAt: course.deletedAt?.toISOString() ?? null,
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function adminCourseWhere(
  query: CourseListQuery,
  scopedTeacherId?: string,
): Prisma.CourseWhereInput {
  const where: Prisma.CourseWhereInput = {};

  if (query.deleted === 'exclude') {
    where.deletedAt = null;
  } else if (query.deleted === 'only') {
    where.deletedAt = { not: null };
  }

  if (query.level) {
    where.level = query.level;
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.teacherId) {
    where.teacherId = query.teacherId;
  }

  if (query.featured !== undefined) {
    where.isFeatured = query.featured;
  }

  if (scopedTeacherId) {
    where.teacherId = scopedTeacherId;
  }

  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: 'insensitive' } },
      { slug: { contains: query.search, mode: 'insensitive' } },
      { shortDescription: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  return where;
}

function catalogWhere(query: CatalogCourseListQuery): Prisma.CourseWhereInput {
  const where: Prisma.CourseWhereInput = {
    status: CourseStatus.PUBLISHED,
    deletedAt: null,
    level: { not: null },
    teacherId: { not: null },
    publishedAt: { not: null },
  };

  if (query.level) {
    where.level = query.level;
  }

  if (query.featured !== undefined) {
    where.isFeatured = query.featured;
  }

  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: 'insensitive' } },
      { slug: { contains: query.search, mode: 'insensitive' } },
      { shortDescription: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  return where;
}

function orderBy(
  sortBy: CourseListQuery['sortBy'] | CatalogCourseListQuery['sortBy'],
  direction: CourseListQuery['sortDirection'],
): Prisma.CourseOrderByWithRelationInput[] {
  return [{ [sortBy]: direction }, { id: direction }];
}

function updateData(data: UpdateCourseData): Prisma.CourseUpdateInput {
  return {
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
  };
}

export interface CourseRepository {
  list(
    query: CourseListQuery,
    scopedTeacherId?: string,
  ): Promise<{ items: CourseRecord[]; total: number }>;
  findById(courseId: string): Promise<CourseRecord | null>;
  create(data: CreateCourseData, context: CourseAuditContext): Promise<CourseRecord>;
  update(
    courseId: string,
    data: UpdateCourseData,
    context: CourseAuditContext,
  ): Promise<CourseRecord | null>;
  updateStatus(
    courseId: string,
    status: CourseStatus,
    context: CourseAuditContext,
  ): Promise<CourseRecord | null>;
  assignTeacher(
    courseId: string,
    teacherId: string | null,
    context: CourseAuditContext,
  ): Promise<CourseRecord | null>;
  softDelete(courseId: string, context: CourseAuditContext): Promise<CourseRecord | null>;
  restore(courseId: string, context: CourseAuditContext): Promise<CourseRecord | null>;
  isEligibleTeacher(userId: string): Promise<boolean>;
  statistics(): Promise<CourseStatistics>;
  listCatalog(query: CatalogCourseListQuery): Promise<{ items: CatalogCourse[]; total: number }>;
  findCatalogBySlug(slug: string): Promise<CatalogCourse | null>;
}

export class PrismaCourseRepository implements CourseRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async list(
    query: CourseListQuery,
    scopedTeacherId?: string,
  ): Promise<{ items: CourseRecord[]; total: number }> {
    const where = adminCourseWhere(query, scopedTeacherId);
    const [courses, total] = await this.client.$transaction([
      this.client.course.findMany({
        where,
        select: courseSelect,
        orderBy: orderBy(query.sortBy, query.sortDirection),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.client.course.count({ where }),
    ]);

    return { items: courses.map(mapCourse), total };
  }

  async findById(courseId: string): Promise<CourseRecord | null> {
    const course = await this.client.course.findUnique({
      where: { id: courseId },
      select: courseSelect,
    });

    return course ? mapCourse(course) : null;
  }

  async create(data: CreateCourseData, context: CourseAuditContext): Promise<CourseRecord> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const course = await transaction.course.create({
          data: {
            title: data.title,
            slug: data.slug,
            ...(data.shortDescription !== undefined
              ? { shortDescription: data.shortDescription }
              : {}),
            ...(data.description !== undefined ? { description: data.description } : {}),
            ...(data.coverImageUrl !== undefined ? { coverImageUrl: data.coverImageUrl } : {}),
            contentLanguage: data.contentLanguage,
            ...(data.level !== undefined ? { level: data.level } : {}),
            ...(data.teacherId !== undefined ? { teacherId: data.teacherId } : {}),
            ...(data.estimatedDurationMinutes !== undefined
              ? { estimatedDurationMinutes: data.estimatedDurationMinutes }
              : {}),
            sortOrder: data.sortOrder,
            isFeatured: data.isFeatured,
            createdByUserId: data.createdByUserId,
          },
          select: courseSelect,
        });
        const mapped = mapCourse(course);

        await transaction.auditLog.create({
          data: {
            ...auditFields(context),
            action: 'courses.created',
            subjectType: 'course',
            subjectId: course.id,
            afterSummary: auditSummary(mapped),
          },
        });

        return mapped;
      });
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        throw new CourseSlugConflictError();
      }

      throw error;
    }
  }

  async update(
    courseId: string,
    data: UpdateCourseData,
    context: CourseAuditContext,
  ): Promise<CourseRecord | null> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const existing = await transaction.course.findUnique({
          where: { id: courseId },
          select: courseSelect,
        });

        if (!existing) {
          return null;
        }

        const before = mapCourse(existing);
        const updated = await transaction.course.update({
          where: { id: courseId },
          data: updateData(data),
          select: courseSelect,
        });
        const after = mapCourse(updated);

        await transaction.auditLog.create({
          data: {
            ...auditFields(context),
            action: 'courses.updated',
            subjectType: 'course',
            subjectId: courseId,
            beforeSummary: auditSummary(before),
            afterSummary: auditSummary(after),
          },
        });

        return after;
      });
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        throw new CourseSlugConflictError();
      }

      throw error;
    }
  }

  async updateStatus(
    courseId: string,
    status: CourseStatus,
    context: CourseAuditContext,
  ): Promise<CourseRecord | null> {
    return this.client.$transaction(async (transaction) => {
      const existing = await transaction.course.findUnique({
        where: { id: courseId },
        select: courseSelect,
      });

      if (!existing) {
        return null;
      }

      const before = mapCourse(existing);
      const now = new Date();
      const lifecycleDates =
        status === CourseStatus.PUBLISHED
          ? { publishedAt: now, archivedAt: null }
          : status === CourseStatus.ARCHIVED
            ? { archivedAt: now }
            : status === CourseStatus.DRAFT && before.status === CourseStatus.ARCHIVED
              ? { publishedAt: null, archivedAt: null }
              : {};
      const updated = await transaction.course.update({
        where: { id: courseId },
        data: { status, ...lifecycleDates },
        select: courseSelect,
      });
      const after = mapCourse(updated);

      await transaction.auditLog.create({
        data: {
          ...auditFields(context),
          action:
            status === CourseStatus.PUBLISHED ? 'courses.published' : 'courses.status_changed',
          subjectType: 'course',
          subjectId: courseId,
          beforeSummary: auditSummary(before),
          afterSummary: auditSummary(after),
        },
      });

      return after;
    });
  }

  async assignTeacher(
    courseId: string,
    teacherId: string | null,
    context: CourseAuditContext,
  ): Promise<CourseRecord | null> {
    return this.client.$transaction(async (transaction) => {
      const existing = await transaction.course.findUnique({
        where: { id: courseId },
        select: courseSelect,
      });

      if (!existing) {
        return null;
      }

      const before = mapCourse(existing);
      const updated = await transaction.course.update({
        where: { id: courseId },
        data: { teacherId },
        select: courseSelect,
      });
      const after = mapCourse(updated);

      await transaction.auditLog.create({
        data: {
          ...auditFields(context),
          action: 'courses.teacher_assigned',
          subjectType: 'course',
          subjectId: courseId,
          beforeSummary: auditSummary(before),
          afterSummary: auditSummary(after),
        },
      });

      return after;
    });
  }

  async softDelete(courseId: string, context: CourseAuditContext): Promise<CourseRecord | null> {
    return this.client.$transaction(async (transaction) => {
      const existing = await transaction.course.findUnique({
        where: { id: courseId },
        select: courseSelect,
      });

      if (!existing) {
        return null;
      }

      const before = mapCourse(existing);

      if (before.deletedAt) {
        return before;
      }

      const deleted = await transaction.course.update({
        where: { id: courseId },
        data: { deletedAt: new Date() },
        select: courseSelect,
      });
      const after = mapCourse(deleted);

      await transaction.auditLog.create({
        data: {
          ...auditFields(context),
          action: 'courses.deleted',
          subjectType: 'course',
          subjectId: courseId,
          beforeSummary: auditSummary(before),
          afterSummary: auditSummary(after),
        },
      });

      return after;
    });
  }

  async restore(courseId: string, context: CourseAuditContext): Promise<CourseRecord | null> {
    return this.client.$transaction(async (transaction) => {
      const existing = await transaction.course.findUnique({
        where: { id: courseId },
        select: courseSelect,
      });

      if (!existing) {
        return null;
      }

      const before = mapCourse(existing);
      const restored = await transaction.course.update({
        where: { id: courseId },
        data: {
          deletedAt: null,
          status: CourseStatus.DRAFT,
          publishedAt: null,
          archivedAt: null,
        },
        select: courseSelect,
      });
      const after = mapCourse(restored);

      await transaction.auditLog.create({
        data: {
          ...auditFields(context),
          action: 'courses.restored',
          subjectType: 'course',
          subjectId: courseId,
          beforeSummary: auditSummary(before),
          afterSummary: auditSummary(after),
        },
      });

      return after;
    });
  }

  async isEligibleTeacher(userId: string): Promise<boolean> {
    const now = new Date();
    const user = await this.client.user.findFirst({
      where: {
        id: userId,
        status: UserStatus.ACTIVE,
        deletedAt: null,
        roles: {
          some: {
            role: { code: RoleCode.TEACHER },
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
        },
      },
      select: { id: true },
    });

    return user !== null;
  }

  async statistics(): Promise<CourseStatistics> {
    const nonDeleted = { deletedAt: null } satisfies Prisma.CourseWhereInput;
    const [total, draft, inReview, published, archived, deleted, featured, teachers] =
      await this.client.$transaction([
        this.client.course.count(),
        this.client.course.count({
          where: { ...nonDeleted, status: CourseStatus.DRAFT },
        }),
        this.client.course.count({
          where: { ...nonDeleted, status: CourseStatus.IN_REVIEW },
        }),
        this.client.course.count({
          where: { ...nonDeleted, status: CourseStatus.PUBLISHED },
        }),
        this.client.course.count({
          where: { ...nonDeleted, status: CourseStatus.ARCHIVED },
        }),
        this.client.course.count({ where: { deletedAt: { not: null } } }),
        this.client.course.count({ where: { ...nonDeleted, isFeatured: true } }),
        this.client.user.findMany({
          where: { coursesTaught: { some: nonDeleted } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            _count: {
              select: {
                coursesTaught: { where: nonDeleted },
              },
            },
          },
          orderBy: { id: 'asc' },
        }),
      ]);
    const levelCounts = await this.client.course.groupBy({
      by: ['level'],
      where: { ...nonDeleted, level: { not: null } },
      orderBy: { level: 'asc' },
      _count: { id: true },
    });
    const byLevel: Record<CourseLevel, number> = {
      A1: 0,
      A2: 0,
      B1: 0,
      B2: 0,
      C1: 0,
      C2: 0,
    };

    for (const level of levelCounts) {
      if (level.level) {
        byLevel[level.level] = level._count.id;
      }
    }

    return {
      total,
      draft,
      inReview,
      published,
      archived,
      deleted,
      featured,
      byLevel,
      byTeacher: teachers.map((teacher) => ({
        teacherId: teacher.id,
        displayName:
          (teacher.displayName ??
            [teacher.firstName, teacher.lastName].filter(Boolean).join(' ')) ||
          'Noma’lum o‘qituvchi',
        count: teacher._count.coursesTaught,
      })),
    };
  }

  async listCatalog(
    query: CatalogCourseListQuery,
  ): Promise<{ items: CatalogCourse[]; total: number }> {
    const where = catalogWhere(query);
    const [courses, total] = await this.client.$transaction([
      this.client.course.findMany({
        where,
        select: courseSelect,
        orderBy: orderBy(query.sortBy, query.sortDirection),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.client.course.count({ where }),
    ]);

    return {
      items: courses
        .map(mapCatalogCourse)
        .filter((course): course is CatalogCourse => course !== null),
      total,
    };
  }

  async findCatalogBySlug(slug: string): Promise<CatalogCourse | null> {
    const course = await this.client.course.findFirst({
      where: {
        slug,
        status: CourseStatus.PUBLISHED,
        deletedAt: null,
        level: { not: null },
        teacherId: { not: null },
        publishedAt: { not: null },
      },
      select: courseSelect,
    });

    return course ? mapCatalogCourse(course) : null;
  }
}
