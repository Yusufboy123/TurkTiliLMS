import { CourseEnrollmentStatus, RoleCode, SessionClientType } from '@prisma/client';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { errorHandler } from '../../src/middlewares/error-handler.middleware.js';
import {
  requirePermission,
  requireRole,
} from '../../src/modules/authorization/authorization.middleware.js';
import type { AuthenticatedPrincipal } from '../../src/modules/authorization/authorization.types.js';
import { ProgressReportingController } from '../../src/modules/progress-reporting/progress-reporting.controller.js';
import type { ProgressReportingRepository } from '../../src/modules/progress-reporting/progress-reporting.repository.js';
import { createProgressReportingRouter } from '../../src/modules/progress-reporting/progress-reporting.routes.js';
import { ProgressReportingService } from '../../src/modules/progress-reporting/progress-reporting.service.js';
import type {
  ProgressReportingQuery,
  ReportingAuditContext,
  ReportingCourseRecord,
  ReportingEnrollmentRecord,
} from '../../src/modules/progress-reporting/progress-reporting.types.js';
import { AppError } from '../../src/utils/app-error.js';
import {
  COURSE_ID,
  ENROLLMENT_ID,
  STUDENT_ID,
  createProgressEnrollment,
} from '../helpers/progress-tracking-fakes.js';

const TEACHER_ID = '019d0000-0000-7000-8000-000000000101';
const ADMIN_ID = '019d0000-0000-7000-8000-000000000102';
const OTHER_COURSE_ID = '019d0000-0000-7000-8000-000000000103';

class FakeProgressReportingRepository implements ProgressReportingRepository {
  course: ReportingCourseRecord = {
    id: COURSE_ID,
    title: 'Turk tili A1',
    slug: 'turk-tili-a1',
    curriculumVersion: 1,
    teacherId: TEACHER_ID,
  };
  enrollment: ReportingEnrollmentRecord = {
    id: ENROLLMENT_ID,
    courseId: COURSE_ID,
    studentId: STUDENT_ID,
    status: CourseEnrollmentStatus.ACTIVE,
    enrolledAt: new Date('2026-07-20T08:00:00.000Z'),
    completedAt: null,
    student: {
      id: STUDENT_ID,
      email: 'student@example.com',
      firstName: 'Ali',
      lastName: 'Valiyev',
      displayName: 'Ali Valiyev',
    },
    progressRoot: {
      firstActivityAt: new Date('2026-07-20T09:00:00.000Z'),
      lastVisitedAt: new Date('2026-07-21T09:00:00.000Z'),
      completedLessons: 1,
      totalEligibleLessons: 4,
      coursePercentage: 25,
    },
  };
  lastQuery: ProgressReportingQuery | null = null;
  audits: string[] = [];

  async findCourse(courseId: string) {
    return courseId === this.course.id ? this.course : null;
  }

  async listEnrollments(query: ProgressReportingQuery, fixedCourseId?: string) {
    this.lastQuery = query;
    return {
      items: !fixedCourseId || fixedCourseId === this.enrollment.courseId ? [this.enrollment] : [],
      total: 41,
    };
  }

  async courseStatistics() {
    return { active: 10, suspended: 1, completed: 4, cancelled: 2, averagePercentage: 46 };
  }

  async adminStatistics() {
    return { total: 41, active: 30, completed: 8, averagePercentage: 52 };
  }

  async findDetailedEnrollment(enrollmentId: string) {
    if (enrollmentId !== ENROLLMENT_ID) return null;
    return {
      enrollment: createProgressEnrollment({
        root: {
          id: '019d0000-0000-7000-8000-000000000120',
          enrollmentId: ENROLLMENT_ID,
          lastVisitedLessonId: null,
          lastVisitedAt: new Date('2026-07-21T09:00:00.000Z'),
          firstActivityAt: new Date('2026-07-20T09:00:00.000Z'),
          completionVersion: 1,
          activityVersion: 2,
          curriculumVersion: 1,
          completedEligibleBlocks: 1,
          totalEligibleBlocks: 1,
          completedLessons: 1,
          totalEligibleLessons: 4,
          coursePercentage: 25,
          frozenAt: null,
          createdAt: new Date('2026-07-20T08:00:00.000Z'),
          updatedAt: new Date('2026-07-21T09:00:00.000Z'),
        },
      }),
      student: this.enrollment.student,
      teacherId: TEACHER_ID,
    };
  }

  async recordAccess(
    action: string,
    _subjectType: string,
    _subjectId: string | null,
    _context: ReportingAuditContext,
  ) {
    this.audits.push(action);
  }
}

const audit: ReportingAuditContext = { actorUserId: TEACHER_ID };
const defaultQuery: ProgressReportingQuery = {
  page: 1,
  pageSize: 20,
  sortBy: 'lastActivityAt',
  sortDirection: 'desc',
};

function actor(userId: string, roles: RoleCode[], permissions: string[]) {
  return { userId, roles, permissions };
}

describe('progress reporting service policies and DTO privacy', () => {
  it('returns an owned teacher course page with server pagination and approved fields', async () => {
    const repository = new FakeProgressReportingRepository();
    const service = new ProgressReportingService(repository);
    const result = await service.listTeacherCourse(
      COURSE_ID,
      { ...defaultQuery, page: 2, search: 'Ali', sortBy: 'percentage' },
      actor(TEACHER_ID, [RoleCode.TEACHER], ['progress.course.read']),
      audit,
    );

    expect(result.pagination).toEqual({ page: 2, pageSize: 20, totalItems: 41, totalPages: 3 });
    expect(repository.lastQuery).toMatchObject({ search: 'Ali', sortBy: 'percentage' });
    expect(result.items[0]).toMatchObject({
      student: { email: 'student@example.com', displayName: 'Ali Valiyev' },
      percentage: 25,
      capabilities: { canReadDetail: true, canExport: false },
    });
    expect(result.items[0]).not.toHaveProperty('student.passwordHash');
    expect(repository.audits).toContain('progress_reporting.course_listed');
  });

  it('denies an unrelated teacher and permits an explicitly authorized administrator', async () => {
    const repository = new FakeProgressReportingRepository();
    const service = new ProgressReportingService(repository);
    await expect(
      service.listTeacherCourse(
        COURSE_ID,
        defaultQuery,
        actor(OTHER_COURSE_ID, [RoleCode.TEACHER], ['progress.course.read']),
        { actorUserId: OTHER_COURSE_ID },
      ),
    ).rejects.toMatchObject({ statusCode: 403, code: 'COURSE_SCOPE_DENIED' });
    await expect(
      service.listTeacherCourse(
        COURSE_ID,
        defaultQuery,
        actor(ADMIN_ID, [RoleCode.ADMIN], ['progress.course.read']),
        { actorUserId: ADMIN_ID },
      ),
    ).resolves.toMatchObject({ course: { id: COURSE_ID } });
  });

  it('enforces admin role and progress.read in direct service calls', async () => {
    const service = new ProgressReportingService(new FakeProgressReportingRepository());
    await expect(
      service.listAdmin(
        defaultQuery,
        actor(TEACHER_ID, [RoleCode.TEACHER], ['progress.read']),
        audit,
      ),
    ).rejects.toMatchObject({ statusCode: 403, code: 'ACCESS_DENIED' });
    await expect(
      service.listAdmin(defaultQuery, actor(ADMIN_ID, [RoleCode.ADMIN], []), {
        actorUserId: ADMIN_ID,
      }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'ACCESS_DENIED' });
  });

  it('returns read-only detail and hides enrollment existence outside the path course', async () => {
    const service = new ProgressReportingService(new FakeProgressReportingRepository());
    const detail = await service.getTeacherEnrollment(
      COURSE_ID,
      ENROLLMENT_ID,
      actor(TEACHER_ID, [RoleCode.TEACHER], ['progress.course.read']),
      audit,
    );
    expect(detail.progress.capabilities).toMatchObject({
      canReadProgress: true,
      canCompleteBlock: false,
      canReopenBlock: false,
      canCompleteLesson: false,
      canReopenLesson: false,
      canRecordActivity: false,
    });
    expect(
      detail.progress.sections
        .flatMap((section) => section.lessons)
        .every(
          (lesson) =>
            !lesson.capabilities.canCompleteLesson &&
            !lesson.capabilities.canReopenLesson &&
            lesson.blocks.every(
              (block) => !block.capabilities.canCompleteBlock && !block.capabilities.canReopenBlock,
            ),
        ),
    ).toBe(true);
    await expect(
      service.getTeacherEnrollment(
        OTHER_COURSE_ID,
        ENROLLMENT_ID,
        actor(TEACHER_ID, [RoleCode.TEACHER], ['progress.course.read']),
        audit,
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

function principal(
  userId: string,
  roles: RoleCode[],
  permissions: string[],
): AuthenticatedPrincipal {
  return {
    userId,
    sessionId: '019d0000-0000-7000-8000-000000000150',
    clientType: SessionClientType.WEB,
    roles,
    permissions,
  };
}

function createApp(authenticatedPrincipal: AuthenticatedPrincipal | null) {
  const repository = new FakeProgressReportingRepository();
  const controller = new ProgressReportingController(new ProgressReportingService(repository));
  const authenticate: RequestHandler = (incoming, _response, next) => {
    if (!authenticatedPrincipal) {
      next(new AppError('Tizimga kiring.', 401, 'AUTHENTICATION_REQUIRED'));
      return;
    }
    (incoming as typeof incoming & { auth?: AuthenticatedPrincipal }).auth = authenticatedPrincipal;
    next();
  };
  const passThrough: RequestHandler = (_request, _response, next) => next();
  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1',
    createProgressReportingRouter({
      controller,
      authentication: authenticate,
      teacherOrAdminRole: requireRole(RoleCode.ADMIN, RoleCode.TEACHER),
      adminRole: requireRole(RoleCode.ADMIN),
      permission: requirePermission,
      rateLimiter: passThrough,
    }),
  );
  app.use(errorHandler);
  return { app, repository };
}

describe('progress reporting routes', () => {
  it('exposes all four approved endpoints with their role boundaries', async () => {
    const teacher = createApp(
      principal(TEACHER_ID, [RoleCode.TEACHER], ['progress.course.read']),
    ).app;
    await request(teacher).get(`/api/v1/courses/${COURSE_ID}/progress`).expect(200);
    await request(teacher)
      .get(`/api/v1/courses/${COURSE_ID}/progress/enrollments/${ENROLLMENT_ID}`)
      .expect(200);
    await request(teacher).get('/api/v1/progress').expect(403);

    const admin = createApp(
      principal(ADMIN_ID, [RoleCode.ADMIN], ['progress.read', 'progress.course.read']),
    ).app;
    await request(admin).get('/api/v1/progress').expect(200);
    await request(admin).get(`/api/v1/progress/enrollments/${ENROLLMENT_ID}`).expect(200);
  });

  it('rejects unauthenticated, student, missing permission, and invalid query requests', async () => {
    await request(createApp(null).app).get('/api/v1/progress').expect(401);
    await request(
      createApp(principal(STUDENT_ID, [RoleCode.STUDENT], ['progress.course.read'])).app,
    )
      .get(`/api/v1/courses/${COURSE_ID}/progress`)
      .expect(403);
    await request(createApp(principal(ADMIN_ID, [RoleCode.ADMIN], [])).app)
      .get('/api/v1/progress')
      .expect(403);
    await request(createApp(principal(ADMIN_ID, [RoleCode.ADMIN], ['progress.read'])).app)
      .get('/api/v1/progress?pageSize=101')
      .expect(422);
  });

  it('passes approved pagination, filtering, and sorting values to the service boundary', async () => {
    const { app, repository } = createApp(principal(ADMIN_ID, [RoleCode.ADMIN], ['progress.read']));
    await request(app)
      .get(
        `/api/v1/progress?page=2&pageSize=10&search=Ali&courseId=${COURSE_ID}&studentId=${STUDENT_ID}&enrollmentStatus=ACTIVE&progressState=IN_PROGRESS&sortBy=studentName&sortDirection=asc`,
      )
      .expect(200);
    expect(repository.lastQuery).toEqual({
      page: 2,
      pageSize: 10,
      search: 'Ali',
      courseId: COURSE_ID,
      studentId: STUDENT_ID,
      enrollmentStatus: CourseEnrollmentStatus.ACTIVE,
      progressState: 'IN_PROGRESS',
      sortBy: 'studentName',
      sortDirection: 'asc',
    });
  });
});
