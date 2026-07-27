import { CourseEnrollmentStatus, type Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type {
  DetailedReportingEnrollment,
  ProgressReportingQuery,
  ReportingAuditContext,
  ReportingCourseRecord,
  ReportingEnrollmentRecord,
  CourseReportingStatistics,
  AdminReportingStatistics,
} from './progress-reporting.types.js';

const reportingEnrollmentSelect = {
  id: true,
  courseId: true,
  studentId: true,
  status: true,
  enrolledAt: true,
  completedAt: true,
  student: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      displayName: true,
    },
  },
  progressRoot: {
    select: {
      firstActivityAt: true,
      lastVisitedAt: true,
      completedLessons: true,
      totalEligibleLessons: true,
      coursePercentage: true,
    },
  },
} satisfies Prisma.CourseEnrollmentSelect;

function progressStateWhere(
  state: ProgressReportingQuery['progressState'],
): Prisma.CourseEnrollmentWhereInput | undefined {
  if (!state) return undefined;
  if (state === 'COMPLETED') return { status: CourseEnrollmentStatus.COMPLETED };
  if (state === 'NOT_STARTED') {
    return {
      status: { not: CourseEnrollmentStatus.COMPLETED },
      OR: [
        { progressRoot: { is: null } },
        {
          progressRoot: {
            is: {
              firstActivityAt: null,
              lastVisitedAt: null,
              completedLessons: 0,
              coursePercentage: 0,
            },
          },
        },
      ],
    };
  }
  return {
    status: { not: CourseEnrollmentStatus.COMPLETED },
    progressRoot: {
      is: {
        OR: [
          { firstActivityAt: { not: null } },
          { lastVisitedAt: { not: null } },
          { completedLessons: { gt: 0 } },
          { coursePercentage: { gt: 0 } },
        ],
      },
    },
  };
}

function reportingWhere(
  query: ProgressReportingQuery,
  fixedCourseId?: string,
): Prisma.CourseEnrollmentWhereInput {
  const state = progressStateWhere(query.progressState);
  return {
    ...(fixedCourseId
      ? { courseId: fixedCourseId }
      : query.courseId
        ? { courseId: query.courseId }
        : {}),
    ...(query.studentId ? { studentId: query.studentId } : {}),
    ...(query.enrollmentStatus ? { status: query.enrollmentStatus } : {}),
    ...(query.search
      ? {
          student: {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' as const } },
              { firstName: { contains: query.search, mode: 'insensitive' as const } },
              { lastName: { contains: query.search, mode: 'insensitive' as const } },
              { displayName: { contains: query.search, mode: 'insensitive' as const } },
            ],
          },
        }
      : {}),
    ...(state ? { AND: [state] } : {}),
  };
}

function reportingOrderBy(
  query: ProgressReportingQuery,
): Prisma.CourseEnrollmentOrderByWithRelationInput[] {
  const direction = query.sortDirection;
  const primary: Prisma.CourseEnrollmentOrderByWithRelationInput =
    query.sortBy === 'lastActivityAt'
      ? { progressRoot: { lastVisitedAt: direction } }
      : query.sortBy === 'completedAt'
        ? { completedAt: direction }
        : query.sortBy === 'percentage'
          ? { progressRoot: { coursePercentage: direction } }
          : query.sortBy === 'studentName'
            ? { student: { displayName: direction } }
            : { enrolledAt: direction };
  return [primary, { id: direction }];
}

function auditFields(context: ReportingAuditContext) {
  return {
    actorUserId: context.actorUserId,
    ...(context.requestCorrelationId ? { requestCorrelationId: context.requestCorrelationId } : {}),
    ...(context.ipHash ? { ipHash: context.ipHash } : {}),
    ...(context.userAgentSummary ? { userAgentSummary: context.userAgentSummary } : {}),
  };
}

export interface ProgressReportingRepository {
  findCourse(courseId: string): Promise<ReportingCourseRecord | null>;
  listEnrollments(
    query: ProgressReportingQuery,
    fixedCourseId?: string,
  ): Promise<{ items: ReportingEnrollmentRecord[]; total: number }>;
  courseStatistics(courseId: string): Promise<CourseReportingStatistics>;
  adminStatistics(query: ProgressReportingQuery): Promise<AdminReportingStatistics>;
  findDetailedEnrollment(enrollmentId: string): Promise<DetailedReportingEnrollment | null>;
  recordAccess(
    action: string,
    subjectType: string,
    subjectId: string | null,
    context: ReportingAuditContext,
  ): Promise<void>;
}

export class PrismaProgressReportingRepository implements ProgressReportingRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async findCourse(courseId: string): Promise<ReportingCourseRecord | null> {
    return this.client.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        title: true,
        slug: true,
        curriculumVersion: true,
        teacherId: true,
      },
    });
  }

  async listEnrollments(
    query: ProgressReportingQuery,
    fixedCourseId?: string,
  ): Promise<{ items: ReportingEnrollmentRecord[]; total: number }> {
    const where = reportingWhere(query, fixedCourseId);
    const [items, total] = await this.client.$transaction([
      this.client.courseEnrollment.findMany({
        where,
        select: reportingEnrollmentSelect,
        orderBy: reportingOrderBy(query),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.client.courseEnrollment.count({ where }),
    ]);
    return { items, total };
  }

  async courseStatistics(courseId: string): Promise<CourseReportingStatistics> {
    const [active, suspended, completed, cancelled, average] = await this.client.$transaction([
      this.client.courseEnrollment.count({
        where: { courseId, status: CourseEnrollmentStatus.ACTIVE },
      }),
      this.client.courseEnrollment.count({
        where: { courseId, status: CourseEnrollmentStatus.SUSPENDED },
      }),
      this.client.courseEnrollment.count({
        where: { courseId, status: CourseEnrollmentStatus.COMPLETED },
      }),
      this.client.courseEnrollment.count({
        where: { courseId, status: CourseEnrollmentStatus.CANCELLED },
      }),
      this.client.enrollmentProgressRoot.aggregate({
        where: { enrollment: { courseId } },
        _avg: { coursePercentage: true },
      }),
    ]);
    return {
      active,
      suspended,
      completed,
      cancelled,
      averagePercentage: Math.floor(average._avg.coursePercentage ?? 0),
    };
  }

  async adminStatistics(query: ProgressReportingQuery): Promise<AdminReportingStatistics> {
    const where = reportingWhere(query);
    const [total, active, completed, average] = await this.client.$transaction([
      this.client.courseEnrollment.count({ where }),
      this.client.courseEnrollment.count({
        where: { AND: [where, { status: CourseEnrollmentStatus.ACTIVE }] },
      }),
      this.client.courseEnrollment.count({
        where: { AND: [where, { status: CourseEnrollmentStatus.COMPLETED }] },
      }),
      this.client.enrollmentProgressRoot.aggregate({
        where: { enrollment: where },
        _avg: { coursePercentage: true },
      }),
    ]);
    return {
      total,
      active,
      completed,
      averagePercentage: Math.floor(average._avg.coursePercentage ?? 0),
    };
  }

  async findDetailedEnrollment(enrollmentId: string): Promise<DetailedReportingEnrollment | null> {
    const enrollment = await this.client.courseEnrollment.findUnique({
      where: { id: enrollmentId },
      select: {
        id: true,
        studentId: true,
        status: true,
        enrolledAt: true,
        startedAt: true,
        completedAt: true,
        cancelledAt: true,
        suspendedAt: true,
        student: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            displayName: true,
          },
        },
        progressRoot: {
          select: {
            id: true,
            enrollmentId: true,
            lastVisitedLessonId: true,
            lastVisitedAt: true,
            firstActivityAt: true,
            completionVersion: true,
            activityVersion: true,
            curriculumVersion: true,
            completedEligibleBlocks: true,
            totalEligibleBlocks: true,
            completedLessons: true,
            totalEligibleLessons: true,
            coursePercentage: true,
            frozenAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            teacherId: true,
            status: true,
            publishedAt: true,
            deletedAt: true,
            curriculumVersion: true,
            sections: {
              where: { isPublished: true, deletedAt: null },
              orderBy: [{ position: 'asc' }, { id: 'asc' }],
              select: {
                id: true,
                title: true,
                position: true,
                lessons: {
                  where: { status: 'PUBLISHED', deletedAt: null },
                  orderBy: [{ position: 'asc' }, { id: 'asc' }],
                  select: {
                    id: true,
                    sectionId: true,
                    title: true,
                    slug: true,
                    position: true,
                    progress: {
                      where: { enrollmentId },
                      take: 1,
                      select: {
                        state: true,
                        firstActivityAt: true,
                        lastActivityAt: true,
                        completedAt: true,
                      },
                    },
                    contentBlocks: {
                      where: { isVisible: true, deletedAt: null },
                      orderBy: [{ position: 'asc' }, { id: 'asc' }],
                      select: {
                        id: true,
                        blockType: true,
                        title: true,
                        position: true,
                        isRequired: true,
                        progress: {
                          where: { enrollmentId },
                          take: 1,
                          select: { state: true, completedAt: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!enrollment) return null;
    return {
      student: enrollment.student,
      teacherId: enrollment.course.teacherId,
      enrollment: {
        id: enrollment.id,
        studentId: enrollment.studentId,
        status: enrollment.status,
        enrolledAt: enrollment.enrolledAt,
        startedAt: enrollment.startedAt,
        completedAt: enrollment.completedAt,
        cancelledAt: enrollment.cancelledAt,
        suspendedAt: enrollment.suspendedAt,
        root: enrollment.progressRoot,
        course: {
          id: enrollment.course.id,
          title: enrollment.course.title,
          slug: enrollment.course.slug,
          status: enrollment.course.status,
          publishedAt: enrollment.course.publishedAt,
          deletedAt: enrollment.course.deletedAt,
          curriculumVersion: enrollment.course.curriculumVersion,
          sections: enrollment.course.sections.map((section) => ({
            id: section.id,
            title: section.title,
            position: section.position,
            lessons: section.lessons.map((lesson) => ({
              id: lesson.id,
              sectionId: lesson.sectionId,
              title: lesson.title,
              slug: lesson.slug,
              position: lesson.position,
              progress: lesson.progress[0] ?? null,
              blocks: lesson.contentBlocks.map((block) => ({
                id: block.id,
                blockType: block.blockType,
                title: block.title,
                position: block.position,
                isRequired: block.isRequired,
                progress: block.progress[0] ?? null,
              })),
            })),
          })),
        },
      },
    };
  }

  async recordAccess(
    action: string,
    subjectType: string,
    subjectId: string | null,
    context: ReportingAuditContext,
  ): Promise<void> {
    await this.client.auditLog.create({
      data: {
        ...auditFields(context),
        action,
        subjectType,
        subjectId,
      },
    });
  }
}
