import {
  LessonContentBlockType,
  MediaCategory,
  MediaStorageProvider,
  Prisma,
  type PrismaClient,
} from '@prisma/client';
import { vi } from 'vitest';
import { PrismaMediaRepository } from '../../src/modules/media/media.repository.js';
import { MEDIA_ID, MEDIA_OWNER_ID, mediaAuditContext } from '../helpers/media-fakes.js';

function databaseMediaFile(deletedAt: Date | null = null) {
  return {
    id: MEDIA_ID,
    originalFileName: 'turk-tili.png',
    storedFileName: '019b9e24-4147-7f4b-9726-e46482877c68.png',
    mimeType: 'image/png',
    extension: 'png',
    category: MediaCategory.IMAGE,
    sizeBytes: 67n,
    storagePath: 'images/019b9e24-4147-7f4b-9726-e46482877c68.png',
    storageProvider: MediaStorageProvider.LOCAL,
    checksum: 'a'.repeat(64),
    uploadedById: MEDIA_OWNER_ID,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt,
  };
}

describe('PrismaMediaRepository', () => {
  it('creates metadata and its audit record in one transaction', async () => {
    const transaction = {
      mediaFile: {
        create: vi.fn().mockResolvedValue(databaseMediaFile()),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
    const executeTransaction = vi
      .fn()
      .mockImplementation((operation: (value: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
      );
    const repository = new PrismaMediaRepository({
      $transaction: executeTransaction,
    } as unknown as PrismaClient);

    const created = await repository.create(
      {
        originalFileName: 'turk-tili.png',
        storedFileName: '019b9e24-4147-7f4b-9726-e46482877c68.png',
        mimeType: 'image/png',
        extension: 'png',
        category: MediaCategory.IMAGE,
        sizeBytes: 67n,
        storagePath: 'images/019b9e24-4147-7f4b-9726-e46482877c68.png',
        storageProvider: MediaStorageProvider.LOCAL,
        checksum: 'a'.repeat(64),
        uploadedById: MEDIA_OWNER_ID,
      },
      mediaAuditContext,
    );

    expect(created.sizeBytes).toBe('67');
    expect(transaction.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'MEDIA_FILE_UPLOADED',
        subjectType: 'media_file',
        subjectId: MEDIA_ID,
        actorUserId: MEDIA_OWNER_ID,
        afterSummary: expect.not.objectContaining({
          storagePath: expect.anything(),
        }),
      }),
    });
  });

  it('soft-deletes metadata without deleting the stored object', async () => {
    const before = databaseMediaFile();
    const deleted = databaseMediaFile(new Date('2026-01-02T00:00:00.000Z'));
    const transaction = {
      mediaFile: {
        findUnique: vi.fn().mockResolvedValue(before),
        update: vi.fn().mockResolvedValue(deleted),
      },
      lessonContentBlock: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
    const repository = new PrismaMediaRepository({
      $transaction: vi
        .fn()
        .mockImplementation((operation: (value: typeof transaction) => Promise<unknown>) =>
          operation(transaction),
        ),
    } as unknown as PrismaClient);

    const result = await repository.softDelete(MEDIA_ID, mediaAuditContext);

    expect(result?.deletedAt).toEqual(deleted.deletedAt);
    expect(transaction.mediaFile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: MEDIA_ID },
        data: { deletedAt: expect.any(Date) },
      }),
    );
    expect(transaction.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'MEDIA_FILE_DELETED',
        subjectId: MEDIA_ID,
      }),
    });
  });

  it('refuses soft deletion when an active content block uses the media', async () => {
    const usage = {
      id: '019b9e23-3b3a-7909-a2c1-0948f9e15717',
      blockType: LessonContentBlockType.IMAGE,
      title: 'Rasm',
      position: 1,
      lesson: {
        id: '019b9e23-1f4f-7b2d-b9b7-2f0fa34b3c51',
        title: 'Salomlashish',
        slug: 'salomlashish',
        course: {
          id: '019b9e23-0f3f-7b2d-b9b7-2f0fa34b3c50',
          title: 'Turk tili A1',
          slug: 'turk-tili-a1',
        },
      },
    };
    const transaction = {
      mediaFile: {
        findUnique: vi.fn().mockResolvedValue(databaseMediaFile()),
        update: vi.fn(),
      },
      lessonContentBlock: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([usage]),
      },
      auditLog: {
        create: vi.fn(),
      },
    };
    const executeTransaction = vi
      .fn()
      .mockImplementation((operation: (value: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
      );
    const repository = new PrismaMediaRepository({
      $transaction: executeTransaction,
    } as unknown as PrismaClient);

    await expect(repository.softDelete(MEDIA_ID, mediaAuditContext)).rejects.toMatchObject({
      activeUsageCount: 1,
      usages: [
        {
          type: 'LESSON_CONTENT_BLOCK',
          block: { id: usage.id },
        },
      ],
    });
    expect(transaction.mediaFile.update).not.toHaveBeenCalled();
    expect(transaction.auditLog.create).not.toHaveBeenCalled();
    expect(executeTransaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it('lists usages with deterministic ordering and no internal storage metadata', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: '019b9e23-3b3a-7909-a2c1-0948f9e15717',
        blockType: LessonContentBlockType.PDF,
        title: 'PDF',
        position: 2,
        lesson: {
          id: '019b9e23-1f4f-7b2d-b9b7-2f0fa34b3c51',
          title: 'Hujjat',
          slug: 'hujjat',
          course: {
            id: '019b9e23-0f3f-7b2d-b9b7-2f0fa34b3c50',
            title: 'Turk tili A1',
            slug: 'turk-tili-a1',
          },
        },
      },
    ]);
    const count = vi.fn().mockResolvedValue(1);
    const repository = new PrismaMediaRepository({
      lessonContentBlock: { findMany, count },
      $transaction: vi
        .fn()
        .mockImplementation((queries: Array<Promise<unknown>>) => Promise.all(queries)),
    } as unknown as PrismaClient);

    const result = await repository.listUsages(MEDIA_ID);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { mediaFileId: MEDIA_ID, deletedAt: null },
        orderBy: [{ lessonId: 'asc' }, { position: 'asc' }, { id: 'asc' }],
        take: 100,
      }),
    );
    expect(result).toMatchObject({
      total: 1,
      items: [
        {
          type: 'LESSON_CONTENT_BLOCK',
          block: { blockType: LessonContentBlockType.PDF },
        },
      ],
    });
    expect(result.items[0]).not.toHaveProperty('storagePath');
  });
});
