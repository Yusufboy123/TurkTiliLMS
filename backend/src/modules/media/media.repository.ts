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

export interface MediaRepository {
  findById(id: string): Promise<MediaFileRecord | null>;
  create(data: CreateMediaFileData, context: MediaAuditContext): Promise<MediaFileRecord>;
  softDelete(id: string, context: MediaAuditContext): Promise<MediaFileRecord | null>;
  restore(id: string, context: MediaAuditContext): Promise<MediaFileRecord | null>;
  listUsages(
    id: string,
    limit?: number,
  ): Promise<{ items: LessonContentBlockMediaUsage[]; total: number }>;
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

  async create(data: CreateMediaFileData, context: MediaAuditContext): Promise<MediaFileRecord> {
    return this.client.$transaction(async (transaction) => {
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
