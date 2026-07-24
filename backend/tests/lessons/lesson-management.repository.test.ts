import { CourseStatus, LessonStatus, Prisma, type PrismaClient } from '@prisma/client';
import { vi } from 'vitest';
import { PrismaLessonManagementRepository } from '../../src/modules/lessons/lesson-management.repository.js';
import {
  LESSON_ID,
  OTHER_SECTION_ID,
  SECTION_ID,
  lesson,
  section,
} from '../helpers/lesson-fakes.js';
import { TEST_COURSE_ID } from '../helpers/course-fakes.js';

const SECOND_LESSON_ID = '019b9e23-2147-7f4b-9726-e46482877c66';
const THIRD_LESSON_ID = '019b9e23-3147-7f4b-9726-e46482877c67';

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

describe('PrismaLessonManagementRepository ordering', () => {
  it('moves section 2 to section 1 without a large temporary offset', async () => {
    const movingSection = {
      ...section({ id: OTHER_SECTION_ID, position: 2 }),
      _count: { lessons: 0 },
    };
    const updatedSection = {
      ...movingSection,
      position: 1,
      deletedAt: null,
    };
    const update = vi
      .fn()
      .mockResolvedValueOnce({ ...movingSection, deletedAt: new Date() })
      .mockResolvedValueOnce(section({ id: SECTION_ID, position: 2 }))
      .mockResolvedValueOnce(updatedSection);
    const transaction = {
      courseSection: {
        findFirst: vi.fn().mockResolvedValue(movingSection),
        count: vi.fn().mockResolvedValue(3),
        findMany: vi.fn().mockResolvedValue([{ id: SECTION_ID, position: 1 }]),
        update,
        findUniqueOrThrow: vi.fn().mockResolvedValue(updatedSection),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const executeTransaction = vi
      .fn()
      .mockImplementation((operation: (value: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
      );
    const repository = new PrismaLessonManagementRepository({
      $transaction: executeTransaction,
    } as unknown as PrismaClient);

    const moved = await repository.reorderSection(TEST_COURSE_ID, OTHER_SECTION_ID, 1, {
      actorUserId: movingSection.createdById,
    });

    expect(moved?.position).toBe(1);
    expect(update).toHaveBeenNthCalledWith(1, {
      where: { id: OTHER_SECTION_ID },
      data: { deletedAt: expect.any(Date) },
    });
    expect(update).toHaveBeenNthCalledWith(2, {
      where: { id: SECTION_ID },
      data: { position: 2 },
    });
    expect(update).toHaveBeenNthCalledWith(3, {
      where: { id: OTHER_SECTION_ID },
      data: { position: 1, deletedAt: null },
    });
    expect(
      update.mock.calls.some(([call]) => {
        const position = (call as { data?: { position?: number } }).data?.position;
        return position !== undefined && Math.abs(position) > 3;
      }),
    ).toBe(false);
    expect(executeTransaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it('moves lesson 2 to lesson 1 without a large temporary offset', async () => {
    const movingLesson = lesson({ id: SECOND_LESSON_ID, position: 2 });
    const movedLesson = lesson({ id: SECOND_LESSON_ID, position: 1 });
    const update = vi
      .fn()
      .mockResolvedValueOnce({ ...movingLesson, deletedAt: new Date() })
      .mockResolvedValueOnce(lesson({ id: THIRD_LESSON_ID, position: 2 }))
      .mockResolvedValueOnce(lesson({ id: THIRD_LESSON_ID, position: 3 }))
      .mockResolvedValueOnce(lesson({ id: LESSON_ID, position: 2 }))
      .mockResolvedValueOnce(movedLesson);
    const transaction = {
      lesson: {
        findFirst: vi.fn().mockResolvedValue(movingLesson),
        count: vi.fn().mockResolvedValue(2),
        findMany: vi
          .fn()
          .mockResolvedValueOnce([{ id: THIRD_LESSON_ID, position: 3 }])
          .mockResolvedValueOnce([
            { id: THIRD_LESSON_ID, position: 2 },
            { id: LESSON_ID, position: 1 },
          ]),
        update,
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const executeTransaction = vi
      .fn()
      .mockImplementation((operation: (value: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
      );
    const repository = new PrismaLessonManagementRepository({
      $transaction: executeTransaction,
    } as unknown as PrismaClient);

    const moved = await repository.reorderLesson(TEST_COURSE_ID, SECOND_LESSON_ID, SECTION_ID, 1, {
      actorUserId: movingLesson.createdBy.id,
    });

    expect(moved?.position).toBe(1);
    expect(update).toHaveBeenNthCalledWith(1, {
      where: { id: SECOND_LESSON_ID },
      data: { deletedAt: expect.any(Date) },
    });
    expect(update).toHaveBeenNthCalledWith(2, {
      where: { id: THIRD_LESSON_ID },
      data: { position: 2 },
    });
    expect(update).toHaveBeenNthCalledWith(3, {
      where: { id: THIRD_LESSON_ID },
      data: { position: 3 },
    });
    expect(update).toHaveBeenNthCalledWith(4, {
      where: { id: LESSON_ID },
      data: { position: 2 },
    });
    expect(update).toHaveBeenNthCalledWith(5, {
      where: { id: SECOND_LESSON_ID },
      data: { sectionId: SECTION_ID, position: 1, deletedAt: null },
      select: expect.any(Object),
    });
    expect(
      update.mock.calls.some(([call]) => {
        const position = (call as { data?: { position?: number } }).data?.position;
        return position !== undefined && Math.abs(position) > 3;
      }),
    ).toBe(false);
    expect(executeTransaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });
});
