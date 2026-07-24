import { MediaCategory, MediaStorageProvider, RoleCode } from '@prisma/client';
import { Readable } from 'node:stream';
import type { MediaFileInspector } from '../../src/modules/media/media.inspector.js';
import type { MediaRepository } from '../../src/modules/media/media.repository.js';
import { MediaInUseError } from '../../src/modules/media/media.repository.js';
import type { PublicMediaReference } from '../../src/modules/media/media-reference.presenter.js';
import type { MediaStorage } from '../../src/modules/media/media.storage.js';
import type {
  CreateMediaFileData,
  InspectedMediaUpload,
  MediaActor,
  MediaAuditContext,
  MediaFileRecord,
  LessonContentBlockMediaUsage,
  MediaTypePolicy,
  StagedMediaUpload,
  StoredMediaObject,
} from '../../src/modules/media/media.types.js';

export const MEDIA_ID = '019b9e24-1147-7f4b-9726-e46482877c65';
export const MEDIA_OWNER_ID = '019b9e24-2147-7f4b-9726-e46482877c66';
export const OTHER_MEDIA_USER_ID = '019b9e24-3147-7f4b-9726-e46482877c67';

export function mediaFile(overrides: Partial<MediaFileRecord> = {}): MediaFileRecord {
  return {
    id: MEDIA_ID,
    originalFileName: 'turk-tili.png',
    storedFileName: '019b9e24-4147-7f4b-9726-e46482877c68.png',
    mimeType: 'image/png',
    extension: 'png',
    category: MediaCategory.IMAGE,
    sizeBytes: '67',
    storagePath: 'images/019b9e24-4147-7f4b-9726-e46482877c68.png',
    storageProvider: MediaStorageProvider.LOCAL,
    checksum: 'a'.repeat(64),
    uploadedById: MEDIA_OWNER_ID,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

export function publicMediaReference(
  overrides: Partial<PublicMediaReference> = {},
): PublicMediaReference {
  return {
    id: MEDIA_ID,
    originalFileName: 'turk-tili.png',
    mimeType: 'image/png',
    extension: 'png',
    category: MediaCategory.IMAGE,
    sizeBytes: '67',
    checksum: 'a'.repeat(64),
    storageProvider: MediaStorageProvider.LOCAL,
    downloadUrl: `/api/v1/media/${MEDIA_ID}/download`,
    previewUrl: `/api/v1/media/${MEDIA_ID}/download`,
    deletedAt: null,
    ...overrides,
  };
}

export function mediaActor(overrides: Partial<MediaActor> = {}): MediaActor {
  return {
    userId: MEDIA_OWNER_ID,
    roles: [RoleCode.TEACHER],
    permissions: ['media.upload', 'media.read', 'media.download', 'media.delete', 'media.restore'],
    ...overrides,
  };
}

export const mediaAuditContext: MediaAuditContext = {
  actorUserId: MEDIA_OWNER_ID,
};

export class FakeMediaRepository implements MediaRepository {
  current: MediaFileRecord | null;
  failCreate = false;
  lastCreateData: CreateMediaFileData | null = null;
  usages: LessonContentBlockMediaUsage[] = [];

  constructor(current: MediaFileRecord | null = mediaFile()) {
    this.current = current;
  }

  findById(id: string): Promise<MediaFileRecord | null> {
    return Promise.resolve(this.current?.id === id ? this.current : null);
  }

  create(data: CreateMediaFileData, _context: MediaAuditContext): Promise<MediaFileRecord> {
    if (this.failCreate) {
      return Promise.reject(new Error('Database unavailable'));
    }
    this.lastCreateData = data;
    this.current = mediaFile({
      originalFileName: data.originalFileName,
      storedFileName: data.storedFileName,
      mimeType: data.mimeType,
      extension: data.extension,
      category: data.category,
      sizeBytes: data.sizeBytes.toString(),
      storagePath: data.storagePath,
      storageProvider: data.storageProvider,
      checksum: data.checksum,
      uploadedById: data.uploadedById,
    });
    return Promise.resolve(this.current);
  }

  softDelete(id: string, _context: MediaAuditContext): Promise<MediaFileRecord | null> {
    if (!this.current || this.current.id !== id) return Promise.resolve(null);
    if (this.usages.length > 0) {
      return Promise.reject(new MediaInUseError(this.usages.length, this.usages.slice(0, 10)));
    }
    this.current = { ...this.current, deletedAt: new Date() };
    return Promise.resolve(this.current);
  }

  restore(id: string, _context: MediaAuditContext): Promise<MediaFileRecord | null> {
    if (!this.current || this.current.id !== id) return Promise.resolve(null);
    this.current = { ...this.current, deletedAt: null };
    return Promise.resolve(this.current);
  }

  listUsages(
    _id: string,
    limit = 100,
  ): Promise<{ items: LessonContentBlockMediaUsage[]; total: number }> {
    return Promise.resolve({
      items: this.usages.slice(0, limit),
      total: this.usages.length,
    });
  }
}

export class FakeMediaStorage implements MediaStorage {
  readonly provider = MediaStorageProvider.LOCAL;
  removedPaths: string[] = [];
  discardedPaths: string[] = [];
  unavailable = false;

  store(
    _stagedUpload: StagedMediaUpload,
    inspectedUpload: InspectedMediaUpload,
  ): Promise<StoredMediaObject> {
    return Promise.resolve({
      storedFileName: `stored.${inspectedUpload.extension}`,
      storagePath: `images/stored.${inspectedUpload.extension}`,
      storageProvider: this.provider,
    });
  }

  open(_storagePath: string): Promise<{ stream: Readable; contentLength: number }> {
    if (this.unavailable) {
      return import('../../src/modules/media/media.storage.js').then(
        ({ MediaStorageObjectNotFoundError }) =>
          Promise.reject(new MediaStorageObjectNotFoundError()),
      );
    }
    return Promise.resolve({
      stream: Readable.from(Buffer.from('media-data')),
      contentLength: 10,
    });
  }

  remove(storagePath: string): Promise<void> {
    this.removedPaths.push(storagePath);
    return Promise.resolve();
  }

  discardStaged(path: string): Promise<void> {
    this.discardedPaths.push(path);
    return Promise.resolve();
  }
}

export class FakeMediaInspector implements MediaFileInspector {
  inspect(
    stagedUpload: StagedMediaUpload,
    originalFileName: string,
    policy: MediaTypePolicy,
  ): Promise<InspectedMediaUpload> {
    return Promise.resolve({
      originalFileName,
      category: policy.category,
      extension: policy.extension,
      mimeType: policy.canonicalMimeType,
      sizeBytes: stagedUpload.sizeBytes,
      checksum: 'b'.repeat(64),
    });
  }
}
