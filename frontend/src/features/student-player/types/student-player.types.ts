import type { LessonContentBlockType } from '../../progress/types/progress.types';

export interface StudentMediaReference {
  id: string;
  originalFileName: string;
  mimeType: string;
  extension: string;
  category: 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'VIDEO';
  sizeBytes: string;
  checksum: string | null;
  storageProvider: 'LOCAL';
  downloadUrl: string | null;
  previewUrl: string | null;
  deletedAt: string | null;
}

export interface StudentLessonContent {
  id: string;
  courseId: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string | null;
  lessonType: 'TEXT' | 'VIDEO' | 'AUDIO' | 'PDF' | 'QUIZ' | 'ASSIGNMENT' | 'LIVE';
  durationMinutes: number | null;
  isPreview: boolean;
  publishedAt: string;
  section: { id: string; title: string };
}

export interface StudentLessonBlock {
  id: string;
  mediaFileId: string | null;
  media: StudentMediaReference | null;
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
