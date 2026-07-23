import { CourseLevel, CourseStatus } from '@prisma/client';
import { CourseService } from '../../src/modules/courses/course.service.js';
import type {
  CatalogCourseListQuery,
  CourseListQuery,
} from '../../src/modules/courses/course.types.js';
import { AppError } from '../../src/utils/app-error.js';
import {
  COURSE_ADMIN_ID,
  COURSE_TEACHER_ID,
  FakeCourseRepository,
  OTHER_TEACHER_ID,
  TEST_COURSE_ID,
  adminCourseActor,
  courseAuditContext,
  createCourseRecord,
  teacherCourseActor,
} from '../helpers/course-fakes.js';

const listQuery: CourseListQuery = {
  page: 1,
  pageSize: 20,
  deleted: 'exclude',
  sortBy: 'createdAt',
  sortDirection: 'desc',
};

const catalogQuery: CatalogCourseListQuery = {
  page: 1,
  pageSize: 20,
  sortBy: 'sortOrder',
  sortDirection: 'asc',
};

function expectAppError(error: unknown, code: string, statusCode: number): void {
  expect(error).toBeInstanceOf(AppError);
  expect(error).toMatchObject({ code, statusCode });
}

describe('CourseService', () => {
  it('allows an admin to create a course and assign an eligible teacher', async () => {
    const repository = new FakeCourseRepository([]);
    const service = new CourseService(repository);

    const course = await service.create(
      {
        title: 'Turk tili asoslari',
        contentLanguage: 'tr',
        teacherId: COURSE_TEACHER_ID,
        sortOrder: 0,
        isFeatured: false,
      },
      adminCourseActor,
      courseAuditContext,
    );

    expect(course.slug).toBe('turk-tili-asoslari');
    expect(course.teacher?.id).toBe(COURSE_TEACHER_ID);
    expect(repository.lastCreateData?.createdByUserId).toBe(COURSE_ADMIN_ID);
    expect(repository.lastAuditContext).toEqual(courseAuditContext);
  });

  it('assigns a permitted teacher to their own newly created course', async () => {
    const repository = new FakeCourseRepository([]);
    const service = new CourseService(repository);

    const course = await service.create(
      {
        title: 'O‘qituvchi kursi',
        contentLanguage: 'tr',
        sortOrder: 0,
        isFeatured: false,
      },
      teacherCourseActor,
      { ...courseAuditContext, actorUserId: COURSE_TEACHER_ID },
    );

    expect(course.teacher?.id).toBe(COURSE_TEACHER_ID);
    expect(repository.lastCreateData?.createdByUserId).toBe(COURSE_TEACHER_ID);
  });

  it('rejects a teacher assigning a new course to another teacher', async () => {
    const service = new CourseService(new FakeCourseRepository([]));

    await expect(
      service.create(
        {
          title: 'Begona kurs',
          contentLanguage: 'tr',
          teacherId: OTHER_TEACHER_ID,
          sortOrder: 0,
          isFeatured: false,
        },
        teacherCourseActor,
        { ...courseAuditContext, actorUserId: COURSE_TEACHER_ID },
      ),
    ).rejects.toSatisfy((error: unknown) => {
      expectAppError(error, 'COURSE_TEACHER_ASSIGNMENT_DENIED', 403);
      return true;
    });
  });

  it('maps duplicate slugs to a stable Uzbek conflict response', async () => {
    const repository = new FakeCourseRepository([]);
    repository.createSlugConflict = true;
    const service = new CourseService(repository);

    await expect(
      service.create(
        {
          title: 'Takroriy kurs',
          slug: 'takroriy-kurs',
          contentLanguage: 'tr',
          sortOrder: 0,
          isFeatured: false,
        },
        adminCourseActor,
        courseAuditContext,
      ),
    ).rejects.toSatisfy((error: unknown) => {
      expectAppError(error, 'COURSE_SLUG_CONFLICT', 409);
      return true;
    });
  });

  it('returns pagination metadata and scopes a teacher list', async () => {
    const secondCourse = createCourseRecord({
      id: '019b9e22-d58e-75bd-9737-eb615a46fb5d',
      slug: 'ikkinchi-kurs',
    });
    const repository = new FakeCourseRepository([createCourseRecord(), secondCourse]);
    const service = new CourseService(repository);

    const result = await service.list({ ...listQuery, pageSize: 1 }, teacherCourseActor);

    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 1,
      totalItems: 2,
      totalPages: 2,
    });
    expect(repository.lastScopedTeacherId).toBe(COURSE_TEACHER_ID);
  });

  it('supports search and level/status filtering', async () => {
    const a2Review = createCourseRecord({
      id: '019b9e22-d58e-75bd-9737-eb615a46fb5d',
      title: 'Muloqot A2',
      slug: 'muloqot-a2',
      level: CourseLevel.A2,
      status: CourseStatus.IN_REVIEW,
    });
    const repository = new FakeCourseRepository([createCourseRecord(), a2Review]);
    const service = new CourseService(repository);

    const result = await service.list(
      {
        ...listQuery,
        search: 'muloqot',
        level: CourseLevel.A2,
        status: CourseStatus.IN_REVIEW,
      },
      adminCourseActor,
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.slug).toBe('muloqot-a2');
    expect(repository.lastListQuery).toMatchObject({
      search: 'muloqot',
      level: CourseLevel.A2,
      status: CourseStatus.IN_REVIEW,
    });
  });

  it('prevents a teacher from accessing another teacher course', async () => {
    const otherCourse = createCourseRecord({
      teacher: {
        id: OTHER_TEACHER_ID,
        firstName: 'Boshqa',
        lastName: 'Ustoz',
        displayName: 'Boshqa Ustoz',
      },
    });
    const service = new CourseService(new FakeCourseRepository([otherCourse]));

    await expect(service.getById(TEST_COURSE_ID, teacherCourseActor)).rejects.toSatisfy(
      (error: unknown) => {
        expectAppError(error, 'COURSE_SCOPE_DENIED', 403);
        return true;
      },
    );
  });

  it('allows DRAFT to IN_REVIEW with submit permission', async () => {
    const repository = new FakeCourseRepository();
    const service = new CourseService(repository);

    const course = await service.updateStatus(
      TEST_COURSE_ID,
      CourseStatus.IN_REVIEW,
      teacherCourseActor,
      { ...courseAuditContext, actorUserId: COURSE_TEACHER_ID },
    );

    expect(course.status).toBe(CourseStatus.IN_REVIEW);
  });

  it('rejects an invalid lifecycle transition', async () => {
    const service = new CourseService(new FakeCourseRepository());

    await expect(
      service.updateStatus(
        TEST_COURSE_ID,
        CourseStatus.PUBLISHED,
        adminCourseActor,
        courseAuditContext,
      ),
    ).rejects.toSatisfy((error: unknown) => {
      expectAppError(error, 'INVALID_COURSE_STATUS_TRANSITION', 409);
      return true;
    });
  });

  it('requires publish permission for IN_REVIEW to PUBLISHED', async () => {
    const reviewCourse = createCourseRecord({ status: CourseStatus.IN_REVIEW });
    const service = new CourseService(new FakeCourseRepository([reviewCourse]));

    await expect(
      service.updateStatus(TEST_COURSE_ID, CourseStatus.PUBLISHED, teacherCourseActor, {
        ...courseAuditContext,
        actorUserId: COURSE_TEACHER_ID,
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expectAppError(error, 'ACCESS_DENIED', 403);
      return true;
    });
  });

  it('requires complete course data before publishing', async () => {
    const incomplete = createCourseRecord({
      status: CourseStatus.IN_REVIEW,
      description: null,
      level: null,
      teacher: null,
    });
    const service = new CourseService(new FakeCourseRepository([incomplete]));

    await expect(
      service.updateStatus(
        TEST_COURSE_ID,
        CourseStatus.PUBLISHED,
        adminCourseActor,
        courseAuditContext,
      ),
    ).rejects.toSatisfy((error: unknown) => {
      expectAppError(error, 'COURSE_NOT_READY_TO_PUBLISH', 422);
      expect(error).toMatchObject({
        details: { missingFields: ['description', 'level', 'teacherId'] },
      });
      return true;
    });
  });

  it('publishes a complete reviewed course and records publishedAt', async () => {
    const reviewCourse = createCourseRecord({ status: CourseStatus.IN_REVIEW });
    const service = new CourseService(new FakeCourseRepository([reviewCourse]));

    const published = await service.updateStatus(
      TEST_COURSE_ID,
      CourseStatus.PUBLISHED,
      adminCourseActor,
      courseAuditContext,
    );

    expect(published.status).toBe(CourseStatus.PUBLISHED);
    expect(published.publishedAt).toBeInstanceOf(Date);
  });

  it('returns published courses in catalog and hides draft courses', async () => {
    const published = createCourseRecord({
      status: CourseStatus.PUBLISHED,
      publishedAt: new Date('2026-02-01T00:00:00.000Z'),
    });
    const draft = createCourseRecord({
      id: '019b9e22-d58e-75bd-9737-eb615a46fb5d',
      slug: 'yashirin-draft',
      status: CourseStatus.DRAFT,
    });
    const service = new CourseService(new FakeCourseRepository([published, draft]));

    const result = await service.listCatalog(catalogQuery);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.slug).toBe('turk-tili-a1');
    expect(result.items[0]).not.toHaveProperty('deletedAt');
    await expect(service.getCatalogBySlug('yashirin-draft')).rejects.toSatisfy((error: unknown) => {
      expectAppError(error, 'COURSE_NOT_FOUND', 404);
      return true;
    });
  });

  it('soft-deletes a course and removes it from catalog visibility', async () => {
    const published = createCourseRecord({
      status: CourseStatus.PUBLISHED,
      publishedAt: new Date(),
    });
    const repository = new FakeCourseRepository([published]);
    const service = new CourseService(repository);

    await service.delete(TEST_COURSE_ID, adminCourseActor, courseAuditContext);

    expect(repository.courses.get(TEST_COURSE_ID)?.deletedAt).toBeInstanceOf(Date);
    await expect(service.getCatalogBySlug('turk-tili-a1')).rejects.toSatisfy((error: unknown) => {
      expectAppError(error, 'COURSE_NOT_FOUND', 404);
      return true;
    });
  });

  it('restores a deleted course safely into DRAFT', async () => {
    const deleted = createCourseRecord({
      status: CourseStatus.PUBLISHED,
      publishedAt: new Date(),
      deletedAt: new Date(),
    });
    const service = new CourseService(new FakeCourseRepository([deleted]));

    const restored = await service.restore(TEST_COURSE_ID, adminCourseActor, courseAuditContext);

    expect(restored).toMatchObject({
      status: CourseStatus.DRAFT,
      deletedAt: null,
      publishedAt: null,
    });
  });

  it('returns full course statistics', async () => {
    const repository = new FakeCourseRepository();
    const service = new CourseService(repository);

    await expect(service.statistics(adminCourseActor)).resolves.toEqual(
      repository.statisticsResult,
    );
  });
});
