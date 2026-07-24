import type { AuthenticatedPrincipal } from '../authorization/authorization.types.js';
import type { CatalogLesson, LessonRecord } from '../lessons/lesson-management.types.js';
import { AppError } from '../../utils/app-error.js';
import {
  LessonBlockPositionCapacityError,
  LessonBlockPositionConflictError,
  type LessonContentBlockRepository,
} from './lesson-content-block.repository.js';
import {
  createLessonContentBlockSchema,
  finalLessonContentBlockSchema,
  updateLessonContentBlockSchema,
  type CreateLessonContentBlockInput,
  type UpdateLessonContentBlockInput,
} from './lesson-content-block.schemas.js';
import type { LessonContentBlockDelivery } from './lesson-content-block.storage.js';
import type {
  LessonBlockActor,
  LessonBlockAuditContext,
  LessonContentBlockListQuery,
  LessonContentBlockPage,
  LessonContentBlockRecord,
  PublicLessonContentBlock,
  UpdateLessonContentBlockData,
} from './lesson-content-block.types.js';
import {
  assertLessonBlockMediaCompatibility,
  mediaFileNotFound,
} from './lesson-content-block.media-policy.js';

export interface LessonContentParentAccess {
  lessonDetail(courseId: string, lessonId: string, actor: LessonBlockActor): Promise<LessonRecord>;
  catalogLesson(
    courseSlug: string,
    lessonSlug: string,
    principal: AuthenticatedPrincipal | null,
  ): Promise<CatalogLesson>;
}

function blockNotFound(): AppError {
  return new AppError('Dars kontent bloki topilmadi.', 404, 'LESSON_BLOCK_NOT_FOUND');
}

function assertPermission(actor: LessonBlockActor, permission: string): void {
  if (!actor.permissions.includes(permission)) {
    throw new AppError('Bu amal uchun ruxsat yetarli emas.', 403, 'ACCESS_DENIED');
  }
}

function mapPositionConflict(error: unknown): never {
  if (error instanceof LessonBlockPositionCapacityError) {
    throw new AppError(
      'Kontent bloklari soni qo‘llab-quvvatlanadigan chegaraga yetdi.',
      409,
      'LESSON_BLOCK_POSITION_CAPACITY_REACHED',
    );
  }
  if (error instanceof LessonBlockPositionConflictError) {
    throw new AppError(
      'Kontent bloklari tartibi bir vaqtda o‘zgartirildi. Amalni qayta urinib ko‘ring.',
      409,
      'LESSON_BLOCK_POSITION_CONFLICT',
    );
  }
  throw error;
}

export class LessonContentBlockService {
  constructor(
    private readonly repository: LessonContentBlockRepository,
    private readonly parents: LessonContentParentAccess,
    private readonly delivery: LessonContentBlockDelivery,
  ) {}

  private async validateMediaReference(
    blockType: LessonContentBlockRecord['blockType'],
    mediaFileId: string | null,
    currentBlock?: LessonContentBlockRecord,
  ): Promise<void> {
    if (!mediaFileId) {
      assertLessonBlockMediaCompatibility(blockType, null);
      return;
    }

    const media =
      currentBlock?.mediaFileId === mediaFileId
        ? currentBlock.media
        : await this.repository.findMediaReference(mediaFileId);
    if (!media) throw mediaFileNotFound();
    assertLessonBlockMediaCompatibility(blockType, media);
  }

  private async managedLesson(
    courseId: string,
    lessonId: string,
    actor: LessonBlockActor,
  ): Promise<LessonRecord> {
    const lesson = await this.parents.lessonDetail(courseId, lessonId, actor);
    if (lesson.deletedAt) {
      throw new AppError(
        'O‘chirilgan dars kontentini boshqarib bo‘lmaydi.',
        409,
        'LESSON_IS_DELETED',
      );
    }
    if (lesson.section.deletedAt) {
      throw new AppError(
        'O‘chirilgan bo‘limdagi dars kontentini boshqarib bo‘lmaydi.',
        409,
        'SECTION_IS_DELETED',
      );
    }
    return lesson;
  }

  private async managedBlock(
    courseId: string,
    lessonId: string,
    blockId: string,
    actor: LessonBlockActor,
  ): Promise<LessonContentBlockRecord> {
    await this.managedLesson(courseId, lessonId, actor);
    const block = await this.repository.find(lessonId, blockId);
    if (!block) throw blockNotFound();
    return block;
  }

  async list(
    courseId: string,
    lessonId: string,
    query: LessonContentBlockListQuery,
    actor: LessonBlockActor,
  ): Promise<LessonContentBlockPage> {
    assertPermission(actor, 'lesson_blocks.read');
    await this.managedLesson(courseId, lessonId, actor);
    const result = await this.repository.list(lessonId, query);
    return {
      items: result.items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems: result.total,
        totalPages: Math.ceil(result.total / query.pageSize),
      },
    };
  }

  async detail(
    courseId: string,
    lessonId: string,
    blockId: string,
    actor: LessonBlockActor,
  ): Promise<LessonContentBlockRecord> {
    assertPermission(actor, 'lesson_blocks.read');
    return this.managedBlock(courseId, lessonId, blockId, actor);
  }

  async create(
    courseId: string,
    lessonId: string,
    input: CreateLessonContentBlockInput,
    actor: LessonBlockActor,
    context: LessonBlockAuditContext,
  ): Promise<LessonContentBlockRecord> {
    assertPermission(actor, 'lesson_blocks.create');
    await this.managedLesson(courseId, lessonId, actor);
    const parsed = createLessonContentBlockSchema.parse(input);
    await this.validateMediaReference(parsed.blockType, parsed.mediaFileId ?? null);
    try {
      return await this.repository.create(
        lessonId,
        {
          blockType: parsed.blockType,
          ...(parsed.mediaFileId ? { mediaFileId: parsed.mediaFileId } : {}),
          ...(parsed.title ? { title: parsed.title } : {}),
          ...(parsed.description ? { description: parsed.description } : {}),
          ...(parsed.position !== undefined ? { position: parsed.position } : {}),
          isRequired: parsed.isRequired,
          isVisible: parsed.isVisible,
          ...(parsed.textContent ? { textContent: parsed.textContent } : {}),
          ...(parsed.sourceUrl ? { sourceUrl: parsed.sourceUrl } : {}),
          ...(parsed.externalProvider ? { externalProvider: parsed.externalProvider } : {}),
          ...(parsed.fileName ? { fileName: parsed.fileName } : {}),
          ...(parsed.originalFileName ? { originalFileName: parsed.originalFileName } : {}),
          ...(parsed.fileUrl ? { fileUrl: parsed.fileUrl } : {}),
          ...(parsed.mimeType ? { mimeType: parsed.mimeType } : {}),
          ...(parsed.fileSizeBytes ? { fileSizeBytes: parsed.fileSizeBytes } : {}),
          ...(parsed.durationSeconds ? { durationSeconds: parsed.durationSeconds } : {}),
          ...(parsed.thumbnailUrl ? { thumbnailUrl: parsed.thumbnailUrl } : {}),
          ...(parsed.metadata ? { metadata: parsed.metadata } : {}),
          createdById: actor.userId,
        },
        context,
      );
    } catch (error: unknown) {
      return mapPositionConflict(error);
    }
  }

  async update(
    courseId: string,
    lessonId: string,
    blockId: string,
    input: UpdateLessonContentBlockInput,
    actor: LessonBlockActor,
    context: LessonBlockAuditContext,
  ): Promise<LessonContentBlockRecord> {
    assertPermission(actor, 'lesson_blocks.update');
    const block = await this.managedBlock(courseId, lessonId, blockId, actor);
    if (block.deletedAt) {
      throw new AppError(
        'O‘chirilgan kontent blokini avval tiklang.',
        409,
        'LESSON_BLOCK_IS_DELETED',
      );
    }
    const parsed = updateLessonContentBlockSchema.parse(input);
    const finalBlockType = parsed.blockType ?? block.blockType;
    const finalMediaFileId =
      parsed.mediaFileId !== undefined ? parsed.mediaFileId : block.mediaFileId;
    await this.validateMediaReference(finalBlockType, finalMediaFileId, block);
    finalLessonContentBlockSchema.parse({
      blockType: finalBlockType,
      textContent: parsed.textContent !== undefined ? parsed.textContent : block.textContent,
      sourceUrl: parsed.sourceUrl !== undefined ? parsed.sourceUrl : block.sourceUrl,
      fileUrl: parsed.fileUrl !== undefined ? parsed.fileUrl : block.fileUrl,
      mimeType: parsed.mimeType !== undefined ? parsed.mimeType : block.mimeType,
    });

    const data: UpdateLessonContentBlockData = {
      ...parsed,
      ...(parsed.metadata === null
        ? { metadata: null }
        : parsed.metadata
          ? { metadata: parsed.metadata }
          : {}),
    };
    try {
      const updated = await this.repository.update(lessonId, blockId, data, context);
      if (!updated) throw blockNotFound();
      return updated;
    } catch (error: unknown) {
      return mapPositionConflict(error);
    }
  }

  async reorder(
    courseId: string,
    lessonId: string,
    blockId: string,
    position: number,
    actor: LessonBlockActor,
    context: LessonBlockAuditContext,
  ): Promise<LessonContentBlockRecord> {
    assertPermission(actor, 'lesson_blocks.reorder');
    const block = await this.managedBlock(courseId, lessonId, blockId, actor);
    if (block.deletedAt) {
      throw new AppError(
        'O‘chirilgan kontent blokini ko‘chirib bo‘lmaydi.',
        409,
        'LESSON_BLOCK_IS_DELETED',
      );
    }
    try {
      const updated = await this.repository.reorder(lessonId, blockId, position, context);
      if (!updated) throw blockNotFound();
      return updated;
    } catch (error: unknown) {
      return mapPositionConflict(error);
    }
  }

  async updateVisibility(
    courseId: string,
    lessonId: string,
    blockId: string,
    isVisible: boolean,
    actor: LessonBlockActor,
    context: LessonBlockAuditContext,
  ): Promise<LessonContentBlockRecord> {
    assertPermission(actor, 'lesson_blocks.manage_visibility');
    const block = await this.managedBlock(courseId, lessonId, blockId, actor);
    if (block.deletedAt) {
      throw new AppError(
        'O‘chirilgan kontent blokining ko‘rinishini o‘zgartirib bo‘lmaydi.',
        409,
        'LESSON_BLOCK_IS_DELETED',
      );
    }
    const updated = await this.repository.updateVisibility(lessonId, blockId, isVisible, context);
    if (!updated) throw blockNotFound();
    return updated;
  }

  async delete(
    courseId: string,
    lessonId: string,
    blockId: string,
    actor: LessonBlockActor,
    context: LessonBlockAuditContext,
  ): Promise<void> {
    assertPermission(actor, 'lesson_blocks.delete');
    const block = await this.managedBlock(courseId, lessonId, blockId, actor);
    if (block.deletedAt) return;
    try {
      if (!(await this.repository.softDelete(lessonId, blockId, context))) {
        throw blockNotFound();
      }
    } catch (error: unknown) {
      mapPositionConflict(error);
    }
  }

  async restore(
    courseId: string,
    lessonId: string,
    blockId: string,
    position: number | undefined,
    actor: LessonBlockActor,
    context: LessonBlockAuditContext,
  ): Promise<LessonContentBlockRecord> {
    assertPermission(actor, 'lesson_blocks.restore');
    const block = await this.managedBlock(courseId, lessonId, blockId, actor);
    if (!block.deletedAt) {
      throw new AppError(
        'Faqat o‘chirilgan kontent blokini tiklash mumkin.',
        409,
        'LESSON_BLOCK_NOT_DELETED',
      );
    }
    await this.validateMediaReference(block.blockType, block.mediaFileId, block);
    try {
      const restored = await this.repository.restore(lessonId, blockId, position, context);
      if (!restored) throw blockNotFound();
      return restored;
    } catch (error: unknown) {
      return mapPositionConflict(error);
    }
  }

  async catalog(
    courseSlug: string,
    lessonSlug: string,
    principal: AuthenticatedPrincipal | null,
  ): Promise<PublicLessonContentBlock[]> {
    const lesson = await this.parents.catalogLesson(courseSlug, lessonSlug, principal);
    const blocks = await this.repository.listPublic(lesson.id);
    return Promise.all(blocks.map((block) => this.delivery.prepare(block)));
  }
}
