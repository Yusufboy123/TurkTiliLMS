import type { RoleCode } from '@prisma/client';

export interface ProductivityActor { userId: string; roles: readonly RoleCode[] }
export type BookmarkTarget = { lessonId: string; vocabularyId?: never } | { vocabularyId: string; lessonId?: never };
export interface BookmarkRecord { id: string; kind: 'LESSON' | 'VOCABULARY'; lessonId: string | null; vocabularyId: string | null; title: string; subtitle: string | null; courseTitle: string; targetUrl: string; createdAt: string }
export interface NoteRecord { id: string; lessonId: string; content: string; createdAt: string; updatedAt: string }
