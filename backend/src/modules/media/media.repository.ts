import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type {
  CreateMediaFileData,
  LessonContentBlockMediaUsage,
  MediaAuditContext,
  MediaFileRecord,
} from './media.types.js';

const MAX_TRANSACTION_ATTEMPTS = 3;
export const MEDIA_USAGE_LIMIT = 100;

const mediaFileSelect = {
  id: true,
  originalFileName: true,
  storedFileName: true,
  mimeType: true,
  extension: true,
  category: true,
  sizeBytes: true,
  storagePath: true,
  storageProvider: true,
  checksum: true,
  uploadedById: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.MediaFileSelect;

type MediaFilePayload = Prisma.MediaFileGetPayload<{ select: typeof mediaFileSelect }>;

function mapMediaFile(file: MediaFilePayload): MediaFileRecord {
  return {
    ...file,
    sizeBytes: file.sizeBytes.toString(),
  };
}

function auditFields(context: MediaAuditContext) {
  return {
    actorUserId: context.actorUserId,
    ...(context.requestCorrelationId ? { requestCorrelationId: context.requestCorrelationId } : {}),
    ...(context.ipHash ? { ipHash: context.ipHash } : {}),
    ...(context.userAgentSummary ? { userAgentSummary: context.userAgentSummary } : {}),
  };
}

function auditSummary(file: MediaFilePayload): Prisma.InputJsonObject {
  return {
    originalFileName: file.originalFileName,
    mimeType: file.mimeType,
    extension: file.extension,
    category: file.category,
    sizeBytes: file.sizeBytes.toString(),
    storageProvider: file.storageProvider,
    checksum: file.checksum,
    uploadedById: file.uploadedById,
    deletedAt: file.deletedAt?.toISOString() ?? null,
  };
}

const usageSelect = {
  id: true,
  blockType: true,
  title: true,
  position: true,
  lesson: {
    select: {
      id: true,
      title: true,
      slug: true,
      course: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
    },
  },
} satisfies Prisma.LessonContentBlockSelect;

type UsagePayload = Prisma.LessonContentBlockGetPayload<{ select: typeof usageSelect }>;

function mapUsage(usage: UsagePayload): LessonContentBlockMediaUsage {
  return {
    type: 'LESSON_CONTENT_BLOCK',
    block: {
      id: usage.id,
      blockType: usage.blockType,
      title: usage.title,
      position: usage.position,
    },
    lesson: {
      id: usage.lesson.id,
      title: usage.lesson.title,
      slug: usage.lesson.slug,
    },
    course: usage.lesson.course,
  };
}

function isRetryableTransactionError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2002' || error.code === 'P2034')
  );
}

async function runSerializableTransaction<T>(
  client: PrismaClient,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await client.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error: unknown) {
      if (!isRetryableTransactionError(error)) {
        throw error;
      }
      if (attempt === MAX_TRANSACTION_ATTEMPTS) {
        throw new MediaTransactionConflictError();
      }
    }
  }
  throw new Error('Serializable media transaction attempts exhausted.');
}

export class MediaInUseError extends Error {
  constructor(
    readonly activeUsageCount: number,
    readonly usages: LessonContentBlockMediaUsage[],
  ) {
    super('Media file is referenced by active content.');
  }
}

export class MediaTransactionConflictError extends Error {}
export class MediaStorageQuotaExceededError extends Error {}

export interface MediaRepository {
  findById(id: string): Promise<MediaFileRecord | null>;
  getActiveStorageUsage(uploaderId: string): Promise<bigint>;
  create(data: CreateMediaFileData, context: MediaAuditContext, quotaBytes?: bigint): Promise<MediaFileRecord>;
  softDelete(id: string, context: MediaAuditContext): Promise<MediaFileRecord | null>;
  restore(id: string, context: MediaAuditContext): Promise<MediaFileRecord | null>;
  listUsages(
    id: string,
    limit?: number,
  ): Promise<{ items: LessonContentBlockMediaUsage[]; total: number }>;
  findStudentMediaAccess(mediaId: string, userId: string, now: Date): Promise<MediaFileRecord | null>;
}

export class PrismaMediaRepository implements MediaRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async findById(id: string): Promise<MediaFileRecord | null> {
    const file = await this.client.mediaFile.findUnique({
      where: { id },
      select: mediaFileSelect,
    });
    return file ? mapMediaFile(file) : null;
  }

  async findStudentMediaAccess(mediaId: string, userId: string, now: Date): Promise<MediaFileRecord | null> {
    const file = await this.client.mediaFile.findFirst({
      where: {
        id: mediaId,
        deletedAt: null,
        lessonContentBlocks: {
          some: {
            deletedAt: null,
            isVisible: true,
            lesson: {
              status: 'PUBLISHED',
              deletedAt: null,
              section: { isPublished: true, deletedAt: null },
              course: {
                status: 'PUBLISHED',
                deletedAt: null,
                enrollments: { some: { studentId: userId, status: { in: ['ACTIVE', 'COMPLETED'] }, accessStartsAt: { lte: now }, accessExpiresAt: { gt: now } } },
              },
            },
          },
        },
      },
      select: mediaFileSelect,
    });
    return file ? mapMediaFile(file) : null;
  }

  async getActiveStorageUsage(uploaderId: string): Promise<bigint> {
    const result = await this.client.mediaFile.aggregate({
      where: { uploadedById: uploaderId, deletedAt: null },
      _sum: { sizeBytes: true },
    });
    return result._sum.sizeBytes ?? 0n;
  }


  async create(data: CreateMediaFileData, context: MediaAuditContext, quotaBytes?: bigint): Promise<MediaFileRecord> {
    return runSerializableTransaction(this.client, async (transaction) => {
      if (quotaBytes !== undefined) {
        const usage = await transaction.mediaFile.aggregate({
          where: { uploadedById: data.uploadedById, deletedAt: null },
          _sum: { sizeBytes: true },
        });
        if ((usage._sum.sizeBytes ?? 0n) + data.sizeBytes > quotaBytes) {
          throw new MediaStorageQuotaExceededError();
        }
      }
      const file = await transaction.mediaFile.create({
        data,
        select: mediaFileSelect,
      });
      await transaction.auditLog.create({
        data: {
          ...auditFields(context),
          action: 'MEDIA_FILE_UPLOADED',
          subjectType: 'media_file',
          subjectId: file.id,
          afterSummary: auditSummary(file),
        },
      });
      return mapMediaFile(file);
    });
  }

  async softDelete(id: string, context: MediaAuditContext): Promise<MediaFileRecord | null> {
    return runSerializableTransaction(this.client, async (transaction) => {
      const before = await transaction.mediaFile.findUnique({
        where: { id },
        select: mediaFileSelect,
      });
      if (!before) return null;
      if (before.deletedAt) return mapMediaFile(before);

      const usageWhere: Prisma.LessonContentBlockWhereInput = {
        mediaFileId: id,
        deletedAt: null,
      };
      const activeUsageCount = await transaction.lessonContentBlock.count({
        where: usageWhere,
      });
      if (activeUsageCount > 0) {
        const usages = await transaction.lessonContentBlock.findMany({
          where: usageWhere,
          select: usageSelect,
          orderBy: [{ lessonId: 'asc' }, { position: 'asc' }, { id: 'asc' }],
          take: 10,
        });
        throw new MediaInUseError(activeUsageCount, usages.map(mapUsage));
      }

      const deleted = await transaction.mediaFile.update({
        where: { id },
        data: { deletedAt: new Date() },
        select: mediaFileSelect,
      });
      await transaction.auditLog.create({
        data: {
          ...auditFields(context),
          action: 'MEDIA_FILE_DELETED',
          subjectType: 'media_file',
          subjectId: id,
          beforeSummary: auditSummary(before),
          afterSummary: auditSummary(deleted),
        },
      });
      return mapMediaFile(deleted);
    });
  }

  async restore(id: string, context: MediaAuditContext): Promise<MediaFileRecord | null> {
    return this.client.$transaction(async (transaction) => {
      const before = await transaction.mediaFile.findUnique({
        where: { id },
        select: mediaFileSelect,
      });
      if (!before) return null;
      if (!before.deletedAt) return mapMediaFile(before);

      const restored = await transaction.mediaFile.update({
        where: { id },
        data: { deletedAt: null },
        select: mediaFileSelect,
      });
      await transaction.auditLog.create({
        data: {
          ...auditFields(context),
          action: 'MEDIA_FILE_RESTORED',
          subjectType: 'media_file',
          subjectId: id,
          beforeSummary: auditSummary(before),
          afterSummary: auditSummary(restored),
        },
      });
      return mapMediaFile(restored);
    });
  }

  async listUsages(
    id: string,
    limit = MEDIA_USAGE_LIMIT,
  ): Promise<{ items: LessonContentBlockMediaUsage[]; total: number }> {
    const where: Prisma.LessonContentBlockWhereInput = {
      mediaFileId: id,
      deletedAt: null,
    };
    const [items, total] = await this.client.$transaction([
      this.client.lessonContentBlock.findMany({
        where,
        select: usageSelect,
        orderBy: [{ lessonId: 'asc' }, { position: 'asc' }, { id: 'asc' }],
        take: limit,
      }),
      this.client.lessonContentBlock.count({ where }),
    ]);
    return { items: items.map(mapUsage), total };
  }
}
