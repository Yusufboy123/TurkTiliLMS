import { RoleCode } from '@prisma/client';
import { AppError } from '../../utils/app-error.js';
import type { MediaFileInspector } from './media.inspector.js';
import { resolveMediaTypePolicy } from './media.policy.js';
import {
  MEDIA_USAGE_LIMIT,
  MediaInUseError,
  MediaTransactionConflictError,
  type MediaRepository,
} from './media.repository.js';
import { MediaStorageObjectNotFoundError, type MediaStorage } from './media.storage.js';
import type {
  MediaActor,
  MediaAuditContext,
  MediaDownload,
  MediaFileRecord,
  MediaFileResponse,
  MediaUsagePage,
  StagedMediaUpload,
  StoredMediaObject,
} from './media.types.js';

function mediaNotFound(): AppError {
  return new AppError('Media fayl topilmadi.', 404, 'MEDIA_FILE_NOT_FOUND');
}

function assertPermission(actor: MediaActor, permission: string): void {
  if (!actor.permissions.includes(permission)) {
    throw new AppError('Bu amal uchun ruxsat yetarli emas.', 403, 'ACCESS_DENIED');
  }
}

function canAccess(actor: MediaActor, file: MediaFileRecord): boolean {
  return actor.roles.includes(RoleCode.ADMIN) || file.uploadedById === actor.userId;
}

function toResponse(file: MediaFileRecord): MediaFileResponse {
  return {
    id: file.id,
    originalFileName: file.originalFileName,
    storedFileName: file.storedFileName,
    mimeType: file.mimeType,
    extension: file.extension,
    category: file.category,
    sizeBytes: file.sizeBytes,
    storageProvider: file.storageProvider,
    checksum: file.checksum,
    uploadedById: file.uploadedById,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
    deletedAt: file.deletedAt,
  };
}

export interface MediaManagementUseCases {
  upload(
    stagedUpload: StagedMediaUpload,
    actor: MediaActor,
    context: MediaAuditContext,
  ): Promise<MediaFileResponse>;
  getById(id: string, actor: MediaActor): Promise<MediaFileResponse>;
  download(id: string, actor: MediaActor): Promise<MediaDownload>;
  delete(id: string, actor: MediaActor, context: MediaAuditContext): Promise<void>;
  restore(id: string, actor: MediaActor, context: MediaAuditContext): Promise<MediaFileResponse>;
  usages(id: string, actor: MediaActor): Promise<MediaUsagePage>;
}

export class MediaService implements MediaManagementUseCases {
  constructor(
    private readonly repository: MediaRepository,
    private readonly storage: MediaStorage,
    private readonly inspector: MediaFileInspector,
  ) {}

  private async accessibleFile(id: string, actor: MediaActor): Promise<MediaFileRecord> {
    const file = await this.repository.findById(id);
    if (!file || !canAccess(actor, file)) {
      throw mediaNotFound();
    }
    return file;
  }

  async upload(
    stagedUpload: StagedMediaUpload,
    actor: MediaActor,
    context: MediaAuditContext,
  ): Promise<MediaFileResponse> {
    assertPermission(actor, 'media.upload');
    let storedObject: StoredMediaObject | undefined;

    try {
      const { originalFileName, policy } = resolveMediaTypePolicy(
        stagedUpload.originalFileName,
        stagedUpload.declaredMimeType,
      );
      const inspected = await this.inspector.inspect(stagedUpload, originalFileName, policy);
      storedObject = await this.storage.store(stagedUpload, inspected);
      const file = await this.repository.create(
        {
          ...storedObject,
          originalFileName: inspected.originalFileName,
          mimeType: inspected.mimeType,
          extension: inspected.extension,
          category: inspected.category,
          sizeBytes: BigInt(inspected.sizeBytes),
          checksum: inspected.checksum,
          uploadedById: actor.userId,
        },
        context,
      );
      return toResponse(file);
    } catch (error: unknown) {
      const cleanupFailures: unknown[] = [];
      if (storedObject) {
        try {
          await this.storage.remove(storedObject.storagePath);
        } catch (cleanupError: unknown) {
          cleanupFailures.push(cleanupError);
        }
      }
      try {
        await this.storage.discardStaged(stagedUpload.path);
      } catch (cleanupError: unknown) {
        cleanupFailures.push(cleanupError);
      }
      if (cleanupFailures.length > 0) {
        throw new AggregateError(
          [error, ...cleanupFailures],
          'Media upload failed and storage cleanup was incomplete.',
        );
      }
      throw error;
    }
  }

  async getById(id: string, actor: MediaActor): Promise<MediaFileResponse> {
    assertPermission(actor, 'media.read');
    return toResponse(await this.accessibleFile(id, actor));
  }

  async download(id: string, actor: MediaActor): Promise<MediaDownload> {
    assertPermission(actor, 'media.download');
    const file = await this.accessibleFile(id, actor);
    if (file.deletedAt) {
      throw new AppError(
        'O‘chirilgan media faylni yuklab bo‘lmaydi.',
        409,
        'MEDIA_FILE_IS_DELETED',
      );
    }
    if (file.storageProvider !== this.storage.provider) {
      throw new AppError(
        'Media saqlash provayderi hozir mavjud emas.',
        503,
        'MEDIA_STORAGE_PROVIDER_UNAVAILABLE',
      );
    }

    try {
      const storedObject = await this.storage.open(file.storagePath);
      return {
        ...storedObject,
        mimeType: file.mimeType,
        originalFileName: file.originalFileName,
      };
    } catch (error: unknown) {
      if (error instanceof MediaStorageObjectNotFoundError) {
        throw new AppError(
          'Media fayl saqlash tizimida topilmadi.',
          503,
          'MEDIA_OBJECT_UNAVAILABLE',
        );
      }
      throw error;
    }
  }

  async delete(id: string, actor: MediaActor, context: MediaAuditContext): Promise<void> {
    assertPermission(actor, 'media.delete');
    const file = await this.accessibleFile(id, actor);
    if (file.deletedAt) return;
    try {
      if (!(await this.repository.softDelete(id, context))) {
        throw mediaNotFound();
      }
    } catch (error: unknown) {
      if (error instanceof MediaInUseError) {
        throw new AppError('Media fayl faol dars kontentida ishlatilmoqda.', 409, 'MEDIA_IN_USE', {
          activeUsageCount: error.activeUsageCount,
          usages: error.usages,
        });
      }
      if (error instanceof MediaTransactionConflictError) {
        throw new AppError(
          'Media fayl holati bir vaqtda o‘zgartirildi. Amalni qayta urinib ko‘ring.',
          409,
          'MEDIA_OPERATION_CONFLICT',
        );
      }
      throw error;
    }
  }

  async restore(
    id: string,
    actor: MediaActor,
    context: MediaAuditContext,
  ): Promise<MediaFileResponse> {
    assertPermission(actor, 'media.restore');
    const file = await this.accessibleFile(id, actor);
    if (!file.deletedAt) return toResponse(file);
    const restored = await this.repository.restore(id, context);
    if (!restored) throw mediaNotFound();
    return toResponse(restored);
  }

  async usages(id: string, actor: MediaActor): Promise<MediaUsagePage> {
    assertPermission(actor, 'media.read');
    await this.accessibleFile(id, actor);
    const result = await this.repository.listUsages(id, MEDIA_USAGE_LIMIT);
    return {
      mediaFileId: id,
      activeOnly: true,
      items: result.items,
      totalItems: result.total,
      limit: MEDIA_USAGE_LIMIT,
      truncated: result.total > result.items.length,
    };
  }
}
