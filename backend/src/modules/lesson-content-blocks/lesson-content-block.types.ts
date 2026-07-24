import type { LessonContentBlockType, Prisma } from '@prisma/client';
import type { ContentActor, ContentAuditContext } from '../lessons/lesson-management.types.js';

export type LessonBlockActor = ContentActor;
export interface LessonBlockAuditContext extends ContentAuditContext {
  courseId: string;
}

export interface LessonContentBlockRecord {
  id: string;
  lessonId: string;
  blockType: LessonContentBlockType;
  title: string | null;
  description: string | null;
  position: number;
  isRequired: boolean;
  isVisible: boolean;
  textContent: string | null;
  sourceUrl: string | null;
  externalProvider: string | null;
  fileName: string | null;
  originalFileName: string | null;
  fileUrl: string | null;
  mimeType: string | null;
  fileSizeBytes: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  metadata: unknown;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface PublicLessonContentBlock {
  id: string;
  blockType: LessonContentBlockType;
  title: string | null;
  description: string | null;
  position: number;
  isRequired: boolean;
  textContent: string | null;
  sourceUrl: string | null;
  externalProvider: string | null;
  fileName: string | null;
  fileUrl: string | null;
  mimeType: string | null;
  fileSizeBytes: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
}

export interface LessonContentBlockListQuery {
  page: number;
  pageSize: number;
  includeDeleted: boolean;
  blockType?: LessonContentBlockType | undefined;
  isVisible?: boolean | undefined;
  isRequired?: boolean | undefined;
}

export interface LessonContentBlockPage {
  items: LessonContentBlockRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface CreateLessonContentBlockData {
  blockType: LessonContentBlockType;
  title?: string | undefined;
  description?: string | undefined;
  position?: number | undefined;
  isRequired: boolean;
  isVisible: boolean;
  textContent?: string | undefined;
  sourceUrl?: string | undefined;
  externalProvider?: string | undefined;
  fileName?: string | undefined;
  originalFileName?: string | undefined;
  fileUrl?: string | undefined;
  mimeType?: string | undefined;
  fileSizeBytes?: bigint | undefined;
  durationSeconds?: number | undefined;
  thumbnailUrl?: string | undefined;
  metadata?: Prisma.InputJsonObject | undefined;
  createdById: string;
}

export interface UpdateLessonContentBlockData {
  blockType?: LessonContentBlockType | undefined;
  title?: string | null | undefined;
  description?: string | null | undefined;
  isRequired?: boolean | undefined;
  textContent?: string | null | undefined;
  sourceUrl?: string | null | undefined;
  externalProvider?: string | null | undefined;
  fileName?: string | null | undefined;
  originalFileName?: string | null | undefined;
  fileUrl?: string | null | undefined;
  mimeType?: string | null | undefined;
  fileSizeBytes?: bigint | null | undefined;
  durationSeconds?: number | null | undefined;
  thumbnailUrl?: string | null | undefined;
  metadata?: Prisma.InputJsonObject | null | undefined;
}
