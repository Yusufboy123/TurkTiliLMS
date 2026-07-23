import { CourseStatus, LessonStatus, type PrismaClient } from '@prisma/client';
import { vi } from 'vitest';
import { PrismaLessonManagementRepository } from '../../src/modules/lessons/lesson-management.repository.js';
import { LESSON_ID, SECTION_ID } from '../helpers/lesson-fakes.js';
import { TEST_COURSE_ID } from '../helpers/course-fakes.js';

describe('PrismaLessonManagementRepository catalog visibility', () => {
  it('filters curriculum to published, active parents and lessons', async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: TEST_COURSE_ID,
      title: 'Turk tili A1',
      slug: 'turk-tili-a1',
      sections: [],
    });
    const repository = new PrismaLessonManagementRepository({
      course: { findFirst },
    } as unknown as PrismaClient);

    await repository.catalogCurriculum('turk-tili-a1');

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          slug: 'turk-tili-a1',
          status: CourseStatus.PUBLISHED,
          deletedAt: null,
        },
        select: expect.objectContaining({
          sections: expect.objectContaining({
            where: { isPublished: true, deletedAt: null },
            select: expect.objectContaining({
              lessons: expect.objectContaining({
                where: {
                  status: LessonStatus.PUBLISHED,
                  deletedAt: null,
                },
              }),
            }),
          }),
        }),
      }),
    );
  });

  it('filters lesson detail to published, active course, section, and lesson records', async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: LESSON_ID,
      courseId: TEST_COURSE_ID,
      title: 'Salomlashish',
      slug: 'salomlashish',
      summary: null,
      content: 'Dars mazmuni',
      lessonType: 'TEXT',
      durationMinutes: 10,
      isPreview: true,
      publishedAt: new Date('2026-01-01T00:00:00.000Z'),
      section: { id: SECTION_ID, title: 'Kirish' },
    });
    const repository = new PrismaLessonManagementRepository({
      lesson: { findFirst },
    } as unknown as PrismaClient);

    await repository.catalogLesson('turk-tili-a1', 'salomlashish');

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          slug: 'salomlashish',
          status: LessonStatus.PUBLISHED,
          deletedAt: null,
          course: {
            slug: 'turk-tili-a1',
            status: CourseStatus.PUBLISHED,
            deletedAt: null,
          },
          section: { isPublished: true, deletedAt: null },
        },
      }),
    );
  });
});
