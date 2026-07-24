import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import {
  mediaReferenceSelect,
  presentMediaReference,
  type MediaReferencePayload,
  type PublicMediaReference,
} from '../media/media-reference.presenter.js';
import {
  assertLessonBlockMediaCompatibility,
  mediaFileNotFound,
} from './lesson-content-block.media-policy.js';
import type {
  CreateLessonContentBlockData,
  LessonBlockAuditContext,
  LessonContentBlockListQuery,
  LessonContentBlockRecord,
  PublicLessonContentBlock,
  UpdateLessonContentBlockData,
} from './lesson-content-block.types.js';

const POSTGRES_INTEGER_MAX = 2_147_483_647;
const MAX_TRANSACTION_ATTEMPTS = 3;

const blockSelect = {
  id: true,
  lessonId: true,
  mediaFileId: true,
  mediaFile: { select: mediaReferenceSelect },
  blockType: true,
  title: true,
  description: true,
  position: true,
  isRequired: true,
  isVisible: true,
  textContent: true,
  sourceUrl: true,
  externalProvider: true,
  fileName: true,
  originalFileName: true,
  fileUrl: true,
  mimeType: true,
  fileSizeBytes: true,
  durationSeconds: true,
  thumbnailUrl: true,
  metadata: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.LessonContentBlockSelect;

const publicBlockSelect = {
  id: true,
  mediaFileId: true,
  mediaFile: { select: mediaReferenceSelect },
  blockType: true,
  title: true,
  description: true,
  position: true,
  isRequired: true,
  textContent: true,
  sourceUrl: true,
  externalProvider: true,
  fileName: true,
  fileUrl: true,
  mimeType: true,
  fileSizeBytes: true,
  durationSeconds: true,
  thumbnailUrl: true,
} satisfies Prisma.LessonContentBlockSelect;

type BlockPayload = Prisma.LessonContentBlockGetPayload<{
  select: typeof blockSelect;
}>;
type PublicBlockPayload = Prisma.LessonContentBlockGetPayload<{
  select: typeof publicBlockSelect;
}>;

export class LessonBlockPositionConflictError extends Error {}
export class LessonBlockPositionCapacityError extends Error {}

function auditFields(context: LessonBlockAuditContext) {
  return {
    actorUserId: context.actorUserId,
    ...(context.requestCorrelationId ? { requestCorrelationId: context.requestCorrelationId } : {}),
    ...(context.ipHash ? { ipHash: context.ipHash } : {}),
    ...(context.userAgentSummary ? { userAgentSummary: context.userAgentSummary } : {}),
  };
}

function mapBlock(block: BlockPayload): LessonContentBlockRecord {
  const { mediaFile, ...fields } = block;
  return {
    ...fields,
    media: presentMediaReference(mediaFile),
    fileSizeBytes: block.fileSizeBytes?.toString() ?? null,
  };
}

function mapPublicBlock(block: PublicBlockPayload): PublicLessonContentBlock {
  return {
    id: block.id,
    mediaFileId: block.mediaFileId,
    media: presentMediaReference(block.mediaFile),
    blockType: block.blockType,
    title: block.title,
    description: block.description,
    position: block.position,
    isRequired: block.isRequired,
    textContent: block.textContent,
    sourceUrl: block.sourceUrl,
    externalProvider: block.externalProvider,
    fileName: block.fileName,
    fileUrl: block.fileUrl,
    mimeType: block.mimeType,
    fileSizeBytes: block.fileSizeBytes?.toString() ?? null,
    durationSeconds: block.durationSeconds,
    thumbnailUrl: block.thumbnailUrl,
  };
}

function blockSummary(block: BlockPayload): Prisma.InputJsonObject {
  return {
    blockType: block.blockType,
    mediaFileId: block.mediaFileId,
    title: block.title,
    position: block.position,
    isRequired: block.isRequired,
    isVisible: block.isVisible,
    hasTextContent: Boolean(block.textContent),
    hasSourceUrl: Boolean(block.sourceUrl),
    hasFileUrl: Boolean(block.fileUrl),
    fileName: block.fileName,
    mimeType: block.mimeType,
    fileSizeBytes: block.fileSizeBytes?.toString() ?? null,
    durationSeconds: block.durationSeconds,
    deletedAt: block.deletedAt?.toISOString() ?? null,
  };
}

async function validatedMediaFile(
  transaction: Prisma.TransactionClient,
  blockType: BlockPayload['blockType'],
  mediaFileId: string | null,
): Promise<MediaReferencePayload | null> {
  const mediaFile = mediaFileId
    ? await transaction.mediaFile.findUnique({
        where: { id: mediaFileId },
        select: mediaReferenceSelect,
      })
    : null;

  if (mediaFileId && !mediaFile) {
    throw mediaFileNotFound();
  }
  assertLessonBlockMediaCompatibility(blockType, mediaFile);
  return mediaFile;
}

function isRetryableOrderingError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2002' || error.code === 'P2034')
  );
}

async function runOrderingTransaction<T>(
  client: PrismaClient,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await client.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error: unknown) {
      if (!isRetryableOrderingError(error)) {
        throw error;
      }
      if (attempt === MAX_TRANSACTION_ATTEMPTS) {
        throw new LessonBlockPositionConflictError();
      }
    }
  }

  throw new LessonBlockPositionConflictError();
}

async function shiftPositionsUp(
  transaction: Prisma.TransactionClient,
  lessonId: string,
  startPosition: number,
  endPosition?: number,
): Promise<void> {
  const blocks = await transaction.lessonContentBlock.findMany({
    where: {
      lessonId,
      deletedAt: null,
      position: {
        gte: startPosition,
        ...(endPosition !== undefined ? { lte: endPosition } : {}),
      },
    },
    select: { id: true, position: true },
    orderBy: { position: 'desc' },
  });

  for (const block of blocks) {
    if (block.position === POSTGRES_INTEGER_MAX) {
      throw new LessonBlockPositionCapacityError();
    }
    await transaction.lessonContentBlock.update({
      where: { id: block.id },
      data: { position: block.position + 1 },
    });
  }
}

async function shiftPositionsDown(
  transaction: Prisma.TransactionClient,
  lessonId: string,
  startPosition: number,
  endPosition?: number,
): Promise<void> {
  const blocks = await transaction.lessonContentBlock.findMany({
    where: {
      lessonId,
      deletedAt: null,
      position: {
        gt: startPosition,
        ...(endPosition !== undefined ? { lte: endPosition } : {}),
      },
    },
    select: { id: true, position: true },
    orderBy: { position: 'asc' },
  });

  for (const block of blocks) {
    await transaction.lessonContentBlock.update({
      where: { id: block.id },
      data: { position: block.position - 1 },
    });
  }
}

export interface LessonContentBlockRepository {
  findMediaReference(id: string): Promise<PublicMediaReference | null>;
  list(
    lessonId: string,
    query: LessonContentBlockListQuery,
  ): Promise<{ items: LessonContentBlockRecord[]; total: number }>;
  find(lessonId: string, blockId: string): Promise<LessonContentBlockRecord | null>;
  create(
    lessonId: string,
    data: CreateLessonContentBlockData,
    context: LessonBlockAuditContext,
  ): Promise<LessonContentBlockRecord>;
  update(
    lessonId: string,
    blockId: string,
    data: UpdateLessonContentBlockData,
    context: LessonBlockAuditContext,
  ): Promise<LessonContentBlockRecord | null>;
  reorder(
    lessonId: string,
    blockId: string,
    position: number,
    context: LessonBlockAuditContext,
  ): Promise<LessonContentBlockRecord | null>;
  updateVisibility(
    lessonId: string,
    blockId: string,
    isVisible: boolean,
    context: LessonBlockAuditContext,
  ): Promise<LessonContentBlockRecord | null>;
  softDelete(
    lessonId: string,
    blockId: string,
    context: LessonBlockAuditContext,
  ): Promise<LessonContentBlockRecord | null>;
  restore(
    lessonId: string,
    blockId: string,
    position: number | undefined,
    context: LessonBlockAuditContext,
  ): Promise<LessonContentBlockRecord | null>;
  listPublic(lessonId: string): Promise<PublicLessonContentBlock[]>;
}

export class PrismaLessonContentBlockRepository implements LessonContentBlockRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async findMediaReference(id: string): Promise<PublicMediaReference | null> {
    const mediaFile = await this.client.mediaFile.findUnique({
      where: { id },
      select: mediaReferenceSelect,
    });
    return presentMediaReference(mediaFile);
  }

  async list(
    lessonId: string,
    query: LessonContentBlockListQuery,
  ): Promise<{ items: LessonContentBlockRecord[]; total: number }> {
    const where: Prisma.LessonContentBlockWhereInput = {
      lessonId,
      ...(query.includeDeleted ? {} : { deletedAt: null }),
      ...(query.blockType ? { blockType: query.blockType } : {}),
      ...(query.isVisible !== undefined ? { isVisible: query.isVisible } : {}),
      ...(query.isRequired !== undefined ? { isRequired: query.isRequired } : {}),
    };
    const [blocks, total] = await this.client.$transaction([
      this.client.lessonContentBlock.findMany({
        where,
        select: blockSelect,
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.client.lessonContentBlock.count({ where }),
    ]);
    return { items: blocks.map(mapBlock), total };
  }

  async find(lessonId: string, blockId: string): Promise<LessonContentBlockRecord | null> {
    const block = await this.client.lessonContentBlock.findFirst({
      where: { id: blockId, lessonId },
      select: blockSelect,
    });
    return block ? mapBlock(block) : null;
  }

  async create(
    lessonId: string,
    data: CreateLessonContentBlockData,
    context: LessonBlockAuditContext,
  ): Promise<LessonContentBlockRecord> {
    return runOrderingTransaction(this.client, async (transaction) => {
      await validatedMediaFile(transaction, data.blockType, data.mediaFileId ?? null);
      const count = await transaction.lessonContentBlock.count({
        where: { lessonId, deletedAt: null },
      });
      const position = Math.min(data.position ?? count + 1, count + 1);
      await shiftPositionsUp(transaction, lessonId, position);
      const block = await transaction.lessonContentBlock.create({
        data: {
          lessonId,
          ...(data.mediaFileId !== undefined ? { mediaFileId: data.mediaFileId } : {}),
          blockType: data.blockType,
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          position,
          isRequired: data.isRequired,
          isVisible: data.isVisible,
          ...(data.textContent !== undefined ? { textContent: data.textContent } : {}),
          ...(data.sourceUrl !== undefined ? { sourceUrl: data.sourceUrl } : {}),
          ...(data.externalProvider !== undefined
            ? { externalProvider: data.externalProvider }
            : {}),
          ...(data.fileName !== undefined ? { fileName: data.fileName } : {}),
          ...(data.originalFileName !== undefined
            ? { originalFileName: data.originalFileName }
            : {}),
          ...(data.fileUrl !== undefined ? { fileUrl: data.fileUrl } : {}),
          ...(data.mimeType !== undefined ? { mimeType: data.mimeType } : {}),
          ...(data.fileSizeBytes !== undefined ? { fileSizeBytes: data.fileSizeBytes } : {}),
          ...(data.durationSeconds !== undefined ? { durationSeconds: data.durationSeconds } : {}),
          ...(data.thumbnailUrl !== undefined ? { thumbnailUrl: data.thumbnailUrl } : {}),
          ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
          createdById: data.createdById,
        },
        select: blockSelect,
      });
      await transaction.auditLog.create({
        data: {
          ...auditFields(context),
          action: 'LESSON_BLOCK_CREATED',
          subjectType: 'lesson_content_block',
          subjectId: block.id,
          afterSummary: blockSummary(block),
          metadata: { courseId: context.courseId, lessonId },
        },
      });
      return mapBlock(block);
    });
  }

  async update(
    lessonId: string,
    blockId: string,
    data: UpdateLessonContentBlockData,
    context: LessonBlockAuditContext,
  ): Promise<LessonContentBlockRecord | null> {
    return runOrderingTransaction(this.client, async (transaction) => {
      const before = await transaction.lessonContentBlock.findFirst({
        where: { id: blockId, lessonId },
        select: blockSelect,
      });
      if (!before) return null;
      const finalBlockType = data.blockType ?? before.blockType;
      const finalMediaFileId =
        data.mediaFileId !== undefined ? data.mediaFileId : before.mediaFileId;
      await validatedMediaFile(transaction, finalBlockType, finalMediaFileId);
      const updated = await transaction.lessonContentBlock.update({
        where: { id: blockId },
        data: {
          ...(data.blockType !== undefined ? { blockType: data.blockType } : {}),
          ...(data.mediaFileId !== undefined ? { mediaFileId: data.mediaFileId } : {}),
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.isRequired !== undefined ? { isRequired: data.isRequired } : {}),
          ...(data.textContent !== undefined ? { textContent: data.textContent } : {}),
          ...(data.sourceUrl !== undefined ? { sourceUrl: data.sourceUrl } : {}),
          ...(data.externalProvider !== undefined
            ? { externalProvider: data.externalProvider }
            : {}),
          ...(data.fileName !== undefined ? { fileName: data.fileName } : {}),
          ...(data.originalFileName !== undefined
            ? { originalFileName: data.originalFileName }
            : {}),
          ...(data.fileUrl !== undefined ? { fileUrl: data.fileUrl } : {}),
          ...(data.mimeType !== undefined ? { mimeType: data.mimeType } : {}),
          ...(data.fileSizeBytes !== undefined ? { fileSizeBytes: data.fileSizeBytes } : {}),
          ...(data.durationSeconds !== undefined ? { durationSeconds: data.durationSeconds } : {}),
          ...(data.thumbnailUrl !== undefined ? { thumbnailUrl: data.thumbnailUrl } : {}),
          ...(data.metadata !== undefined
            ? {
                metadata: data.metadata === null ? Prisma.DbNull : data.metadata,
              }
            : {}),
        },
        select: blockSelect,
      });
      await transaction.auditLog.create({
        data: {
          ...auditFields(context),
          action: 'LESSON_BLOCK_UPDATED',
          subjectType: 'lesson_content_block',
          subjectId: blockId,
          beforeSummary: blockSummary(before),
          afterSummary: blockSummary(updated),
          metadata: { courseId: context.courseId, lessonId },
        },
      });
      if (before.mediaFileId !== updated.mediaFileId) {
        const action =
          before.mediaFileId === null
            ? 'LESSON_BLOCK_MEDIA_ASSIGNED'
            : updated.mediaFileId === null
              ? 'LESSON_BLOCK_MEDIA_REMOVED'
              : 'LESSON_BLOCK_MEDIA_REPLACED';
        await transaction.auditLog.create({
          data: {
            ...auditFields(context),
            action,
            subjectType: 'lesson_content_block',
            subjectId: blockId,
            beforeSummary: { mediaFileId: before.mediaFileId },
            afterSummary: { mediaFileId: updated.mediaFileId },
            metadata: { courseId: context.courseId, lessonId },
          },
        });
      }
      return mapBlock(updated);
    });
  }

  async reorder(
    lessonId: string,
    blockId: string,
    requestedPosition: number,
    context: LessonBlockAuditContext,
  ): Promise<LessonContentBlockRecord | null> {
    return runOrderingTransaction(this.client, async (transaction) => {
      const before = await transaction.lessonContentBlock.findFirst({
        where: { id: blockId, lessonId, deletedAt: null },
        select: blockSelect,
      });
      if (!before) return null;
      const count = await transaction.lessonContentBlock.count({
        where: { lessonId, deletedAt: null },
      });
      const position = Math.min(requestedPosition, count);
      if (position !== before.position) {
        await transaction.lessonContentBlock.update({
          where: { id: blockId },
          data: { deletedAt: new Date() },
        });
        if (position < before.position) {
          await shiftPositionsUp(transaction, lessonId, position, before.position - 1);
        } else {
          await shiftPositionsDown(transaction, lessonId, before.position, position);
        }
      }
      const updated = await transaction.lessonContentBlock.update({
        where: { id: blockId },
        data: { position, deletedAt: null },
        select: blockSelect,
      });
      await transaction.auditLog.create({
        data: {
          ...auditFields(context),
          action: 'LESSON_BLOCK_REORDERED',
          subjectType: 'lesson_content_block',
          subjectId: blockId,
          beforeSummary: { position: before.position },
          afterSummary: { position },
          metadata: { courseId: context.courseId, lessonId },
        },
      });
      return mapBlock(updated);
    });
  }

  async updateVisibility(
    lessonId: string,
    blockId: string,
    isVisible: boolean,
    context: LessonBlockAuditContext,
  ): Promise<LessonContentBlockRecord | null> {
    return this.client.$transaction(async (transaction) => {
      const before = await transaction.lessonContentBlock.findFirst({
        where: { id: blockId, lessonId },
        select: blockSelect,
      });
      if (!before) return null;
      const updated = await transaction.lessonContentBlock.update({
        where: { id: blockId },
        data: { isVisible },
        select: blockSelect,
      });
      await transaction.auditLog.create({
        data: {
          ...auditFields(context),
          action: 'LESSON_BLOCK_VISIBILITY_CHANGED',
          subjectType: 'lesson_content_block',
          subjectId: blockId,
          beforeSummary: { isVisible: before.isVisible },
          afterSummary: { isVisible },
          metadata: { courseId: context.courseId, lessonId },
        },
      });
      return mapBlock(updated);
    });
  }

  async softDelete(
    lessonId: string,
    blockId: string,
    context: LessonBlockAuditContext,
  ): Promise<LessonContentBlockRecord | null> {
    return runOrderingTransaction(this.client, async (transaction) => {
      const before = await transaction.lessonContentBlock.findFirst({
        where: { id: blockId, lessonId },
        select: blockSelect,
      });
      if (!before) return null;
      if (before.deletedAt) return mapBlock(before);
      const updated = await transaction.lessonContentBlock.update({
        where: { id: blockId },
        data: { deletedAt: new Date() },
        select: blockSelect,
      });
      await shiftPositionsDown(transaction, lessonId, before.position);
      await transaction.auditLog.create({
        data: {
          ...auditFields(context),
          action: 'LESSON_BLOCK_DELETED',
          subjectType: 'lesson_content_block',
          subjectId: blockId,
          beforeSummary: blockSummary(before),
          afterSummary: blockSummary(updated),
          metadata: { courseId: context.courseId, lessonId },
        },
      });
      return mapBlock(updated);
    });
  }

  async restore(
    lessonId: string,
    blockId: string,
    requestedPosition: number | undefined,
    context: LessonBlockAuditContext,
  ): Promise<LessonContentBlockRecord | null> {
    return runOrderingTransaction(this.client, async (transaction) => {
      const before = await transaction.lessonContentBlock.findFirst({
        where: { id: blockId, lessonId },
        select: blockSelect,
      });
      if (!before) return null;
      const count = await transaction.lessonContentBlock.count({
        where: { lessonId, deletedAt: null },
      });
      await validatedMediaFile(transaction, before.blockType, before.mediaFileId);
      const position = Math.min(requestedPosition ?? count + 1, count + 1);
      await shiftPositionsUp(transaction, lessonId, position);
      const updated = await transaction.lessonContentBlock.update({
        where: { id: blockId },
        data: { deletedAt: null, position },
        select: blockSelect,
      });
      await transaction.auditLog.create({
        data: {
          ...auditFields(context),
          action: 'LESSON_BLOCK_RESTORED',
          subjectType: 'lesson_content_block',
          subjectId: blockId,
          beforeSummary: blockSummary(before),
          afterSummary: blockSummary(updated),
          metadata: { courseId: context.courseId, lessonId },
        },
      });
      return mapBlock(updated);
    });
  }

  async listPublic(lessonId: string): Promise<PublicLessonContentBlock[]> {
    const blocks = await this.client.lessonContentBlock.findMany({
      where: { lessonId, deletedAt: null, isVisible: true },
      select: publicBlockSelect,
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });
    return blocks.map(mapPublicBlock);
  }
}
