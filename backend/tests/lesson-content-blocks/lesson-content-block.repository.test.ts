import { LessonContentBlockType, Prisma, type PrismaClient } from '@prisma/client';
import { vi } from 'vitest';
import { PrismaLessonContentBlockRepository } from '../../src/modules/lesson-content-blocks/lesson-content-block.repository.js';
import {
  BLOCK_ONE_ID,
  BLOCK_THREE_ID,
  BLOCK_TWO_ID,
  blockAuditContext,
} from '../helpers/lesson-content-block-fakes.js';
import { COURSE_TEACHER_ID } from '../helpers/course-fakes.js';
import { LESSON_ID } from '../helpers/lesson-fakes.js';

function databaseBlock(
  overrides: Partial<{
    id: string;
    blockType: LessonContentBlockType;
    position: number;
    deletedAt: Date | null;
  }> = {},
) {
  return {
    id: BLOCK_ONE_ID,
    lessonId: LESSON_ID,
    blockType: LessonContentBlockType.TEXT,
    title: 'Kirish',
    description: null,
    position: 1,
    isRequired: true,
    isVisible: true,
    textContent: 'Dars matni',
    sourceUrl: null,
    externalProvider: null,
    fileName: null,
    originalFileName: null,
    fileUrl: null,
    mimeType: null,
    fileSizeBytes: 1024n,
    durationSeconds: null,
    thumbnailUrl: null,
    metadata: null,
    createdById: COURSE_TEACHER_ID,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

type DatabaseBlock = ReturnType<typeof databaseBlock>;

function orderingHarness(initialBlocks: DatabaseBlock[], failOnUpdate?: number) {
  let blocks = initialBlocks.map((block) => ({ ...block }));
  let updateNumber = 0;

  const lessonContentBlock = {
    findFirst: vi.fn(
      ({
        where,
      }: {
        where: { id: string; lessonId: string; deletedAt?: null };
      }): Promise<DatabaseBlock | null> =>
        Promise.resolve(
          blocks.find(
            (block) =>
              block.id === where.id &&
              block.lessonId === where.lessonId &&
              (where.deletedAt === undefined || block.deletedAt === where.deletedAt),
          ) ?? null,
        ),
    ),
    count: vi.fn(({ where }: { where: { lessonId: string; deletedAt: null } }): Promise<number> =>
      Promise.resolve(
        blocks.filter(
          (block) => block.lessonId === where.lessonId && block.deletedAt === where.deletedAt,
        ).length,
      ),
    ),
    findMany: vi.fn(
      ({
        where,
        orderBy,
      }: {
        where: {
          lessonId: string;
          deletedAt: null;
          position: { gte?: number; gt?: number; lte?: number };
        };
        orderBy: { position: 'asc' | 'desc' };
      }): Promise<Array<{ id: string; position: number }>> => {
        const matches = blocks
          .filter(
            (block) =>
              block.lessonId === where.lessonId &&
              block.deletedAt === null &&
              (where.position.gte === undefined || block.position >= where.position.gte) &&
              (where.position.gt === undefined || block.position > where.position.gt) &&
              (where.position.lte === undefined || block.position <= where.position.lte),
          )
          .sort((left, right) =>
            orderBy.position === 'asc'
              ? left.position - right.position
              : right.position - left.position,
          );
        return Promise.resolve(matches.map(({ id, position }) => ({ id, position })));
      },
    ),
    update: vi.fn(
      ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<Pick<DatabaseBlock, 'position' | 'deletedAt'>>;
      }): Promise<DatabaseBlock> => {
        updateNumber += 1;
        if (failOnUpdate === updateNumber) {
          return Promise.reject(new Error('Simulated database failure'));
        }
        const index = blocks.findIndex((block) => block.id === where.id);
        const updated = { ...blocks[index], ...data } as DatabaseBlock;
        blocks[index] = updated;

        const duplicate = blocks.some(
          (block, otherIndex) =>
            otherIndex !== index &&
            block.lessonId === updated.lessonId &&
            block.deletedAt === null &&
            updated.deletedAt === null &&
            block.position === updated.position,
        );
        if (duplicate) return Promise.reject(new Error('Active position conflict'));
        return Promise.resolve(updated);
      },
    ),
  };
  const transaction = {
    lessonContentBlock,
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const executeTransaction = vi.fn(
    async (operation: (value: typeof transaction) => Promise<unknown>): Promise<unknown> => {
      const snapshot = blocks.map((block) => ({ ...block }));
      try {
        return await operation(transaction);
      } catch (error: unknown) {
        blocks = snapshot;
        throw error;
      }
    },
  );

  return {
    client: { $transaction: executeTransaction } as unknown as PrismaClient,
    executeTransaction,
    positions: () => Object.fromEntries(blocks.map((block) => [block.id, block.position])),
    activePositions: () =>
      blocks
        .filter((block) => block.deletedAt === null)
        .map((block) => block.position)
        .sort((left, right) => left - right),
    deletedAt: (blockId: string) => blocks.find((block) => block.id === blockId)?.deletedAt ?? null,
  };
}

describe('PrismaLessonContentBlockRepository', () => {
  it('creates at the next position in a serializable transaction', async () => {
    const transaction = {
      lessonContentBlock: {
        count: vi.fn().mockResolvedValue(3),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockImplementation(({ data }: { data: { position: number } }) =>
          Promise.resolve({
            ...databaseBlock(),
            position: data.position,
          }),
        ),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const executeTransaction = vi
      .fn()
      .mockImplementation((operation: (value: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
      );
    const repository = new PrismaLessonContentBlockRepository({
      $transaction: executeTransaction,
    } as unknown as PrismaClient);

    const created = await repository.create(
      LESSON_ID,
      {
        blockType: LessonContentBlockType.TEXT,
        textContent: 'Dars matni',
        isRequired: true,
        isVisible: true,
        createdById: COURSE_TEACHER_ID,
      },
      blockAuditContext,
    );

    expect(created.position).toBe(4);
    expect(transaction.lessonContentBlock.findMany).toHaveBeenCalledOnce();
    expect(executeTransaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'LESSON_BLOCK_CREATED',
          subjectId: BLOCK_ONE_ID,
        }),
      }),
    );
  });

  it('moves position 2 to position 1 without exceeding INTEGER or violating active uniqueness', async () => {
    const harness = orderingHarness([
      databaseBlock({ id: BLOCK_ONE_ID, blockType: LessonContentBlockType.TEXT, position: 1 }),
      databaseBlock({ id: BLOCK_TWO_ID, blockType: LessonContentBlockType.VIDEO, position: 2 }),
      databaseBlock({ id: BLOCK_THREE_ID, blockType: LessonContentBlockType.PDF, position: 3 }),
    ]);
    const repository = new PrismaLessonContentBlockRepository(harness.client);

    const moved = await repository.reorder(LESSON_ID, BLOCK_TWO_ID, 1, blockAuditContext);

    expect(moved?.position).toBe(1);
    expect(harness.positions()).toEqual({
      [BLOCK_ONE_ID]: 2,
      [BLOCK_TWO_ID]: 1,
      [BLOCK_THREE_ID]: 3,
    });
    expect(harness.activePositions()).toEqual([1, 2, 3]);
    expect(harness.executeTransaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it('rolls back every position when a reorder step fails', async () => {
    const harness = orderingHarness(
      [
        databaseBlock({ id: BLOCK_ONE_ID, position: 1 }),
        databaseBlock({ id: BLOCK_TWO_ID, position: 2 }),
        databaseBlock({ id: BLOCK_THREE_ID, position: 3 }),
      ],
      2,
    );
    const repository = new PrismaLessonContentBlockRepository(harness.client);

    await expect(repository.reorder(LESSON_ID, BLOCK_TWO_ID, 1, blockAuditContext)).rejects.toThrow(
      'Simulated database failure',
    );

    expect(harness.positions()).toEqual({
      [BLOCK_ONE_ID]: 1,
      [BLOCK_TWO_ID]: 2,
      [BLOCK_THREE_ID]: 3,
    });
    expect(harness.deletedAt(BLOCK_TWO_ID)).toBeNull();
    expect(harness.activePositions()).toEqual([1, 2, 3]);
    expect(harness.executeTransaction).toHaveBeenCalledOnce();
  });

  it('returns only visible active blocks through the public query', async () => {
    const findMany = vi.fn().mockResolvedValue([databaseBlock()]);
    const repository = new PrismaLessonContentBlockRepository({
      lessonContentBlock: { findMany },
    } as unknown as PrismaClient);

    const blocks = await repository.listPublic(LESSON_ID);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          lessonId: LESSON_ID,
          deletedAt: null,
          isVisible: true,
        },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
      }),
    );
    expect(blocks[0]).toMatchObject({
      id: BLOCK_ONE_ID,
      fileSizeBytes: '1024',
    });
    expect(blocks[0]).not.toHaveProperty('createdById');
    expect(blocks[0]).not.toHaveProperty('metadata');
    expect(blocks[0]).not.toHaveProperty('deletedAt');
  });
});
