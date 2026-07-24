import { LessonContentBlockType, RoleCode } from '@prisma/client';
import type { LessonContentBlockRepository } from '../../src/modules/lesson-content-blocks/lesson-content-block.repository.js';
import type {
  CreateLessonContentBlockData,
  LessonBlockActor,
  LessonBlockAuditContext,
  LessonContentBlockListQuery,
  LessonContentBlockRecord,
  PublicLessonContentBlock,
  UpdateLessonContentBlockData,
} from '../../src/modules/lesson-content-blocks/lesson-content-block.types.js';
import { COURSE_ADMIN_ID, COURSE_TEACHER_ID, TEST_COURSE_ID } from './course-fakes.js';
import { LESSON_ID } from './lesson-fakes.js';

export const BLOCK_ONE_ID = '019b9e23-3b3a-7909-a2c1-0948f9e15717';
export const BLOCK_TWO_ID = '019b9e23-4b0a-763e-8fe6-c1d0a7f6c9a8';
export const BLOCK_THREE_ID = '019b9e23-5cf3-744f-859b-eeb646a8e497';

export const blockAuditContext: LessonBlockAuditContext = {
  actorUserId: COURSE_TEACHER_ID,
  courseId: TEST_COURSE_ID,
};

const allBlockPermissions = [
  'lesson_blocks.read',
  'lesson_blocks.create',
  'lesson_blocks.update',
  'lesson_blocks.delete',
  'lesson_blocks.restore',
  'lesson_blocks.reorder',
  'lesson_blocks.manage_visibility',
];

export const adminBlockActor: LessonBlockActor = {
  userId: COURSE_ADMIN_ID,
  roles: [RoleCode.ADMIN],
  permissions: allBlockPermissions,
};

export const teacherBlockActor: LessonBlockActor = {
  userId: COURSE_TEACHER_ID,
  roles: [RoleCode.TEACHER],
  permissions: allBlockPermissions,
};

export function contentBlock(
  overrides: Partial<LessonContentBlockRecord> = {},
): LessonContentBlockRecord {
  return {
    id: BLOCK_ONE_ID,
    lessonId: LESSON_ID,
    blockType: LessonContentBlockType.TEXT,
    title: 'Kirish matni',
    description: null,
    position: 1,
    isRequired: true,
    isVisible: true,
    textContent: 'Salomlashish darsiga kirish.',
    sourceUrl: null,
    externalProvider: null,
    fileName: null,
    originalFileName: null,
    fileUrl: null,
    mimeType: null,
    fileSizeBytes: null,
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

function toPublic(block: LessonContentBlockRecord): PublicLessonContentBlock {
  return {
    id: block.id,
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
    fileSizeBytes: block.fileSizeBytes,
    durationSeconds: block.durationSeconds,
    thumbnailUrl: block.thumbnailUrl,
  };
}

export class FakeLessonContentBlockRepository implements LessonContentBlockRepository {
  readonly blocks = new Map<string, LessonContentBlockRecord>();
  lastCreateData: CreateLessonContentBlockData | null = null;
  lastListQuery: LessonContentBlockListQuery | null = null;

  constructor(blocks: LessonContentBlockRecord[] = [contentBlock()]) {
    for (const block of blocks) this.blocks.set(block.id, block);
  }

  private active(lessonId: string): LessonContentBlockRecord[] {
    return [...this.blocks.values()]
      .filter((block) => block.lessonId === lessonId && block.deletedAt === null)
      .sort((left, right) => left.position - right.position);
  }

  list(
    lessonId: string,
    query: LessonContentBlockListQuery,
  ): Promise<{ items: LessonContentBlockRecord[]; total: number }> {
    this.lastListQuery = query;
    let items = [...this.blocks.values()].filter(
      (block) => block.lessonId === lessonId && (query.includeDeleted || block.deletedAt === null),
    );
    if (query.blockType) {
      items = items.filter((block) => block.blockType === query.blockType);
    }
    if (query.isVisible !== undefined) {
      items = items.filter((block) => block.isVisible === query.isVisible);
    }
    if (query.isRequired !== undefined) {
      items = items.filter((block) => block.isRequired === query.isRequired);
    }
    items.sort((left, right) => left.position - right.position);
    const total = items.length;
    const offset = (query.page - 1) * query.pageSize;
    return Promise.resolve({
      items: items.slice(offset, offset + query.pageSize),
      total,
    });
  }

  find(lessonId: string, blockId: string): Promise<LessonContentBlockRecord | null> {
    const block = this.blocks.get(blockId);
    return Promise.resolve(block?.lessonId === lessonId ? block : null);
  }

  create(lessonId: string, data: CreateLessonContentBlockData): Promise<LessonContentBlockRecord> {
    this.lastCreateData = data;
    const active = this.active(lessonId);
    const position = Math.min(data.position ?? active.length + 1, active.length + 1);
    for (const block of active) {
      if (block.position >= position) {
        this.blocks.set(block.id, {
          ...block,
          position: block.position + 1,
        });
      }
    }
    const block = contentBlock({
      id: '019b9e23-6e5e-7819-b1da-3f3d0d506fde',
      lessonId,
      blockType: data.blockType,
      title: data.title ?? null,
      description: data.description ?? null,
      position,
      isRequired: data.isRequired,
      isVisible: data.isVisible,
      textContent: data.textContent ?? null,
      sourceUrl: data.sourceUrl ?? null,
      externalProvider: data.externalProvider ?? null,
      fileName: data.fileName ?? null,
      originalFileName: data.originalFileName ?? null,
      fileUrl: data.fileUrl ?? null,
      mimeType: data.mimeType ?? null,
      fileSizeBytes: data.fileSizeBytes?.toString() ?? null,
      durationSeconds: data.durationSeconds ?? null,
      thumbnailUrl: data.thumbnailUrl ?? null,
      metadata: data.metadata ?? null,
      createdById: data.createdById,
    });
    this.blocks.set(block.id, block);
    return Promise.resolve(block);
  }

  update(
    lessonId: string,
    blockId: string,
    data: UpdateLessonContentBlockData,
  ): Promise<LessonContentBlockRecord | null> {
    const block = this.blocks.get(blockId);
    if (!block || block.lessonId !== lessonId) {
      return Promise.resolve(null);
    }
    const updated: LessonContentBlockRecord = {
      ...block,
      ...(data.blockType !== undefined ? { blockType: data.blockType } : {}),
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.isRequired !== undefined ? { isRequired: data.isRequired } : {}),
      ...(data.textContent !== undefined ? { textContent: data.textContent } : {}),
      ...(data.sourceUrl !== undefined ? { sourceUrl: data.sourceUrl } : {}),
      ...(data.externalProvider !== undefined ? { externalProvider: data.externalProvider } : {}),
      ...(data.fileName !== undefined ? { fileName: data.fileName } : {}),
      ...(data.originalFileName !== undefined ? { originalFileName: data.originalFileName } : {}),
      ...(data.fileUrl !== undefined ? { fileUrl: data.fileUrl } : {}),
      ...(data.mimeType !== undefined ? { mimeType: data.mimeType } : {}),
      ...(data.fileSizeBytes !== undefined
        ? {
            fileSizeBytes: data.fileSizeBytes === null ? null : data.fileSizeBytes.toString(),
          }
        : {}),
      ...(data.durationSeconds !== undefined ? { durationSeconds: data.durationSeconds } : {}),
      ...(data.thumbnailUrl !== undefined ? { thumbnailUrl: data.thumbnailUrl } : {}),
      metadata: data.metadata === undefined ? block.metadata : data.metadata,
      updatedAt: new Date(),
    };
    this.blocks.set(blockId, updated);
    return Promise.resolve(updated);
  }

  reorder(
    lessonId: string,
    blockId: string,
    requestedPosition: number,
  ): Promise<LessonContentBlockRecord | null> {
    const block = this.blocks.get(blockId);
    if (!block || block.lessonId !== lessonId || block.deletedAt) {
      return Promise.resolve(null);
    }
    const active = this.active(lessonId);
    const position = Math.min(requestedPosition, active.length);
    for (const sibling of active) {
      if (sibling.id === blockId) continue;
      if (
        block.position < position &&
        sibling.position > block.position &&
        sibling.position <= position
      ) {
        this.blocks.set(sibling.id, {
          ...sibling,
          position: sibling.position - 1,
        });
      }
      if (
        block.position > position &&
        sibling.position >= position &&
        sibling.position < block.position
      ) {
        this.blocks.set(sibling.id, {
          ...sibling,
          position: sibling.position + 1,
        });
      }
    }
    const updated = { ...block, position };
    this.blocks.set(blockId, updated);
    return Promise.resolve(updated);
  }

  updateVisibility(
    lessonId: string,
    blockId: string,
    isVisible: boolean,
  ): Promise<LessonContentBlockRecord | null> {
    const block = this.blocks.get(blockId);
    if (!block || block.lessonId !== lessonId) {
      return Promise.resolve(null);
    }
    const updated = { ...block, isVisible };
    this.blocks.set(blockId, updated);
    return Promise.resolve(updated);
  }

  softDelete(lessonId: string, blockId: string): Promise<LessonContentBlockRecord | null> {
    const block = this.blocks.get(blockId);
    if (!block || block.lessonId !== lessonId) {
      return Promise.resolve(null);
    }
    if (block.deletedAt) return Promise.resolve(block);
    const deleted = { ...block, deletedAt: new Date() };
    this.blocks.set(blockId, deleted);
    for (const sibling of this.active(lessonId)) {
      if (sibling.position > block.position) {
        this.blocks.set(sibling.id, {
          ...sibling,
          position: sibling.position - 1,
        });
      }
    }
    return Promise.resolve(deleted);
  }

  restore(
    lessonId: string,
    blockId: string,
    requestedPosition: number | undefined,
  ): Promise<LessonContentBlockRecord | null> {
    const block = this.blocks.get(blockId);
    if (!block || block.lessonId !== lessonId) {
      return Promise.resolve(null);
    }
    const active = this.active(lessonId);
    const position = Math.min(requestedPosition ?? active.length + 1, active.length + 1);
    for (const sibling of active) {
      if (sibling.position >= position) {
        this.blocks.set(sibling.id, {
          ...sibling,
          position: sibling.position + 1,
        });
      }
    }
    const restored = { ...block, deletedAt: null, position };
    this.blocks.set(blockId, restored);
    return Promise.resolve(restored);
  }

  listPublic(lessonId: string): Promise<PublicLessonContentBlock[]> {
    return Promise.resolve(
      this.active(lessonId)
        .filter((block) => block.isVisible)
        .map(toPublic),
    );
  }
}
