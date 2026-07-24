import type {
  LessonContentBlockType,
  MediaCategory,
  MediaStorageProvider,
  RoleCode,
} from '@prisma/client';
import type { Readable } from 'node:stream';

export interface MediaActor {
  userId: string;
  roles: RoleCode[];
  permissions: string[];
}

export interface MediaAuditContext {
  actorUserId: string;
  requestCorrelationId?: string;
  ipHash?: string;
  userAgentSummary?: string;
}

export interface StagedMediaUpload {
  path: string;
  originalFileName: string;
  declaredMimeType: string;
  sizeBytes: number;
}

export interface MediaTypePolicy {
  category: MediaCategory;
  extension: string;
  canonicalMimeType: string;
  acceptedDeclaredMimeTypes: readonly string[];
  acceptedDetectedExtensions: readonly string[];
}

export interface InspectedMediaUpload {
  originalFileName: string;
  category: MediaCategory;
  extension: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
}

export interface StoredMediaObject {
  storedFileName: string;
  storagePath: string;
  storageProvider: MediaStorageProvider;
}

export interface MediaFileRecord {
  id: string;
  originalFileName: string;
  storedFileName: string;
  mimeType: string;
  extension: string;
  category: MediaCategory;
  sizeBytes: string;
  storagePath: string;
  storageProvider: MediaStorageProvider;
  checksum: string | null;
  uploadedById: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export type MediaFileResponse = Omit<MediaFileRecord, 'storagePath'>;

export interface CreateMediaFileData {
  originalFileName: string;
  storedFileName: string;
  mimeType: string;
  extension: string;
  category: MediaCategory;
  sizeBytes: bigint;
  storagePath: string;
  storageProvider: MediaStorageProvider;
  checksum: string;
  uploadedById: string;
}

export interface MediaDownload {
  stream: Readable;
  contentLength: number;
  mimeType: string;
  originalFileName: string;
}

export interface LessonContentBlockMediaUsage {
  type: 'LESSON_CONTENT_BLOCK';
  block: {
    id: string;
    blockType: LessonContentBlockType;
    title: string | null;
    position: number;
  };
  lesson: {
    id: string;
    title: string;
    slug: string;
  };
  course: {
    id: string;
    title: string;
    slug: string;
  };
}

export interface MediaUsagePage {
  mediaFileId: string;
  activeOnly: true;
  items: LessonContentBlockMediaUsage[];
  totalItems: number;
  limit: number;
  truncated: boolean;
}
