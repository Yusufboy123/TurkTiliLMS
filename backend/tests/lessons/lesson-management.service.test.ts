import { CourseStatus, LessonStatus, LessonType, RoleCode } from '@prisma/client';
import {
  LessonSlugConflictError,
  SectionNotEmptyError,
} from '../../src/modules/lessons/lesson-management.repository.js';
import {
  EnrollmentPendingLessonAccessPolicy,
  LessonManagementService,
} from '../../src/modules/lessons/lesson-management.service.js';
import { AppError } from '../../src/utils/app-error.js';
import {
  COURSE_TEACHER_ID,
  FakeCourseRepository,
  OTHER_TEACHER_ID,
  TEST_COURSE_ID,
  adminCourseActor,
  createCourseRecord,
  teacherCourseActor,
} from '../helpers/course-fakes.js';
import {
  FakeLessonRepository,
  LESSON_ID,
  SECTION_ID,
  contentAudit,
  lesson,
  section,
} from '../helpers/lesson-fakes.js';

function setup(course = createCourseRecord()) {
  const repo = new FakeLessonRepository();
  const courses = new FakeCourseRepository([course]);
  return {
    repo,
    courses,
    service: new LessonManagementService(repo, courses, new EnrollmentPendingLessonAccessPolicy()),
  };
}
function expectCode(error: unknown, code: string) {
  expect(error).toBeInstanceOf(AppError);
  expect(error).toMatchObject({ code });
}

describe('LessonManagementService', () => {
  it('creates a section with repository-assigned next position', async () => {
    const { repo, service } = setup();
    const result = await service.createSection(
      TEST_COURSE_ID,
      { title: 'Yangi bo‘lim' },
      teacherCourseActor,
      contentAudit,
    );
    expect(result.position).toBe(1);
    expect(repo.lastCreateSection?.position).toBeUndefined();
  });
  it('blocks a teacher on an unrelated course', async () => {
    const otherCourse = createCourseRecord({
      teacher: {
        id: '019b9e23-99d1-7ad7-bd89-aabc602e6eed',
        firstName: null,
        lastName: null,
        displayName: null,
      },
    });
    const { service } = setup(otherCourse);
    await expect(service.listSections(TEST_COURSE_ID, teacherCourseActor)).rejects.toSatisfy(
      (e: unknown) => {
        expectCode(e, 'COURSE_SCOPE_DENIED');
        return true;
      },
    );
  });
  it('blocks management under a soft-deleted course', async () => {
    const { service } = setup(createCourseRecord({ deletedAt: new Date() }));

    await expect(service.listSections(TEST_COURSE_ID, adminCourseActor)).rejects.toSatisfy(
      (error: unknown) => {
        expectCode(error, 'COURSE_IS_DELETED');
        return true;
      },
    );
  });
  it('allows an admin to update and delete section content', async () => {
    const { repo, service } = setup();

    const updatedSection = await service.updateSection(
      TEST_COURSE_ID,
      SECTION_ID,
      { title: 'Yangilangan bo‘lim' },
      adminCourseActor,
      contentAudit,
    );
    const updatedLesson = await service.updateLesson(
      TEST_COURSE_ID,
      LESSON_ID,
      { title: 'Yangilangan dars' },
      adminCourseActor,
      contentAudit,
    );

    expect(updatedSection.title).toBe('Yangilangan bo‘lim');
    expect(updatedLesson.title).toBe('Yangilangan dars');

    repo.currentLesson = null;
    await service.deleteSection(TEST_COURSE_ID, SECTION_ID, adminCourseActor, contentAudit);
    expect(repo.currentSection?.deletedAt).toBeInstanceOf(Date);
  });
  it('rejects section deletion when active lessons remain', async () => {
    const { repo, service } = setup();
    repo.deleteSection = () => Promise.reject(new SectionNotEmptyError());
    await expect(
      service.deleteSection(TEST_COURSE_ID, SECTION_ID, teacherCourseActor, contentAudit),
    ).rejects.toSatisfy((e: unknown) => {
      expectCode(e, 'SECTION_NOT_EMPTY');
      return true;
    });
  });
  it('restores a deleted section unpublished', async () => {
    const { repo, service } = setup();
    repo.currentSection = section({ deletedAt: new Date(), isPublished: true });
    const restored = await service.restoreSection(
      TEST_COURSE_ID,
      SECTION_ID,
      teacherCourseActor,
      contentAudit,
    );
    expect(restored).toMatchObject({ deletedAt: null, isPublished: false });
  });
  it('generates a lesson slug and leaves position automatic', async () => {
    const { repo, service } = setup();
    const result = await service.createLesson(
      TEST_COURSE_ID,
      {
        sectionId: SECTION_ID,
        title: 'Turkcha Salom',
        lessonType: LessonType.TEXT,
        isPreview: false,
      },
      teacherCourseActor,
      contentAudit,
    );
    expect(result.slug).toBe('turkcha-salom');
    expect(repo.lastCreateLesson?.position).toBeUndefined();
  });
  it('rejects a section from another course', async () => {
    const { repo, service } = setup();
    repo.currentSection = null;
    await expect(
      service.createLesson(
        TEST_COURSE_ID,
        { sectionId: SECTION_ID, title: 'Dars', lessonType: LessonType.TEXT, isPreview: false },
        teacherCourseActor,
        contentAudit,
      ),
    ).rejects.toSatisfy((e: unknown) => {
      expectCode(e, 'SECTION_NOT_FOUND');
      return true;
    });
  });
  it('maps duplicate lesson slugs', async () => {
    const { repo, service } = setup();
    repo.createLesson = () => Promise.reject(new LessonSlugConflictError());
    await expect(
      service.createLesson(
        TEST_COURSE_ID,
        {
          sectionId: SECTION_ID,
          title: 'Dars nomi',
          slug: 'dars-nomi',
          lessonType: LessonType.TEXT,
          isPreview: false,
        },
        teacherCourseActor,
        contentAudit,
      ),
    ).rejects.toSatisfy((e: unknown) => {
      expectCode(e, 'LESSON_SLUG_CONFLICT');
      return true;
    });
  });
  it('allows DRAFT to IN_REVIEW', async () => {
    const { service } = setup();
    const result = await service.updateLessonStatus(
      TEST_COURSE_ID,
      LESSON_ID,
      LessonStatus.IN_REVIEW,
      teacherCourseActor,
      contentAudit,
    );
    expect(result.status).toBe(LessonStatus.IN_REVIEW);
  });
  it('rejects invalid lifecycle transitions', async () => {
    const { service } = setup();
    await expect(
      service.updateLessonStatus(
        TEST_COURSE_ID,
        LESSON_ID,
        LessonStatus.PUBLISHED,
        adminCourseActor,
        contentAudit,
      ),
    ).rejects.toSatisfy((e: unknown) => {
      expectCode(e, 'INVALID_LESSON_STATUS_TRANSITION');
      return true;
    });
  });
  it('blocks publication under an unpublished course', async () => {
    const { repo, service } = setup(createCourseRecord({ status: CourseStatus.DRAFT }));
    repo.currentLesson = lesson({
      status: LessonStatus.IN_REVIEW,
      section: { ...lesson().section, isPublished: true },
    });
    await expect(
      service.updateLessonStatus(
        TEST_COURSE_ID,
        LESSON_ID,
        LessonStatus.PUBLISHED,
        adminCourseActor,
        contentAudit,
      ),
    ).rejects.toSatisfy((e: unknown) => {
      expectCode(e, 'COURSE_NOT_PUBLISHED');
      return true;
    });
  });
  it('blocks publication in an unpublished section', async () => {
    const { repo, service } = setup(createCourseRecord({ status: CourseStatus.PUBLISHED }));
    repo.currentLesson = lesson({ status: LessonStatus.IN_REVIEW });
    await expect(
      service.updateLessonStatus(
        TEST_COURSE_ID,
        LESSON_ID,
        LessonStatus.PUBLISHED,
        adminCourseActor,
        contentAudit,
      ),
    ).rejects.toSatisfy((e: unknown) => {
      expectCode(e, 'SECTION_NOT_PUBLISHED');
      return true;
    });
  });
  it('supports cross-section lesson movement after target validation', async () => {
    const { repo, service } = setup();
    repo.currentSection = section({ id: '019b9e23-01e4-7de0-826f-c6f34c10a2af' });
    const moved = await service.reorderLesson(
      TEST_COURSE_ID,
      LESSON_ID,
      repo.currentSection.id,
      1,
      teacherCourseActor,
      contentAudit,
    );
    expect(moved.section.id).toBe(repo.currentSection.id);
  });
  it('supports reordering a lesson inside its current section', async () => {
    const { service } = setup();

    const moved = await service.reorderLesson(
      TEST_COURSE_ID,
      LESSON_ID,
      undefined,
      3,
      teacherCourseActor,
      contentAudit,
    );

    expect(moved).toMatchObject({
      position: 3,
      section: { id: SECTION_ID },
    });
  });
  it('allows an admin to assign an eligible lesson teacher', async () => {
    const { service } = setup();

    await expect(
      service.assignLessonTeacher(
        TEST_COURSE_ID,
        LESSON_ID,
        OTHER_TEACHER_ID,
        adminCourseActor,
        contentAudit,
      ),
    ).resolves.toMatchObject({ id: LESSON_ID });
  });
  it('soft deletes and restores a lesson as DRAFT', async () => {
    const { repo, service } = setup();
    await service.deleteLesson(TEST_COURSE_ID, LESSON_ID, teacherCourseActor, contentAudit);
    expect(repo.currentLesson?.deletedAt).toBeInstanceOf(Date);
    const restored = await service.restoreLesson(
      TEST_COURSE_ID,
      LESSON_ID,
      teacherCourseActor,
      contentAudit,
    );
    expect(restored).toMatchObject({ deletedAt: null, status: LessonStatus.DRAFT });
  });
  it('returns filters, pagination, and statistics', async () => {
    const { repo, service } = setup();
    const query = {
      page: 1,
      pageSize: 10,
      status: LessonStatus.DRAFT,
      lessonType: LessonType.TEXT,
      includeDeleted: false,
      sortBy: 'position' as const,
      sortDirection: 'asc' as const,
    };
    const page = await service.listLessons(TEST_COURSE_ID, query, teacherCourseActor);
    expect(page.pagination.totalItems).toBe(1);
    expect(repo.lastScopedQuery).toEqual(query);
    await expect(
      service.lessonStatistics(TEST_COURSE_ID, teacherCourseActor),
    ).resolves.toMatchObject({ total: 1 });
  });
  it('returns published curriculum and preview lesson', async () => {
    const { repo, service } = setup();
    repo.curriculumResult = {
      course: { id: TEST_COURSE_ID, title: 'Kurs', slug: 'kurs' },
      sections: [],
    };
    repo.catalogLessonResult = {
      id: LESSON_ID,
      courseId: TEST_COURSE_ID,
      title: 'Preview',
      slug: 'preview',
      summary: null,
      content: 'Safe',
      lessonType: LessonType.TEXT,
      durationMinutes: 5,
      isPreview: true,
      publishedAt: new Date(),
      section: { id: SECTION_ID, title: 'Bo‘lim' },
    };
    await expect(service.curriculum('kurs')).resolves.toEqual(repo.curriculumResult);
    await expect(service.catalogLesson('kurs', 'preview', null)).resolves.toEqual(
      repo.catalogLessonResult,
    );
  });
  it('protects non-preview lessons before enrollment exists', async () => {
    const { repo, service } = setup();
    repo.catalogLessonResult = {
      id: LESSON_ID,
      courseId: TEST_COURSE_ID,
      title: 'Private',
      slug: 'private',
      summary: null,
      content: 'Protected',
      lessonType: LessonType.TEXT,
      durationMinutes: 5,
      isPreview: false,
      publishedAt: new Date(),
      section: { id: SECTION_ID, title: 'Bo‘lim' },
    };
    await expect(service.catalogLesson('kurs', 'private', null)).rejects.toSatisfy((e: unknown) => {
      expectCode(e, 'LESSON_AUTHENTICATION_REQUIRED');
      return true;
    });
    const principal = {
      userId: COURSE_TEACHER_ID,
      sessionId: '019b9e23-1f0d-7edb-a715-4ed52e80a7f7',
      clientType: 'WEB' as const,
      roles: [RoleCode.STUDENT],
      permissions: [],
    };
    await expect(service.catalogLesson('kurs', 'private', principal)).rejects.toSatisfy(
      (e: unknown) => {
        expectCode(e, 'LESSON_ENROLLMENT_REQUIRED');
        return true;
      },
    );
  });
});
