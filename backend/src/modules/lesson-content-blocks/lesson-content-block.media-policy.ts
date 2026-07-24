import { LessonContentBlockType, MediaCategory, type MediaStorageProvider } from '@prisma/client';
import { AppError } from '../../utils/app-error.js';

export interface CompatibleMediaFile {
  id: string;
  category: MediaCategory;
  mimeType: string;
  extension: string;
  storageProvider: MediaStorageProvider;
  deletedAt: Date | null;
}

type MediaRule =
  | { mode: 'FORBIDDEN' }
  | {
      mode: 'REQUIRED';
      category: MediaCategory;
      mimeType?: string;
      extension?: string;
    };

/**
 * This is the single domain policy for attaching managed media to lesson
 * blocks. DOWNLOAD intentionally accepts documents only for the first release.
 */
const mediaRules: Record<LessonContentBlockType, MediaRule> = {
  [LessonContentBlockType.TEXT]: { mode: 'FORBIDDEN' },
  [LessonContentBlockType.LINK]: { mode: 'FORBIDDEN' },
  [LessonContentBlockType.IMAGE]: {
    mode: 'REQUIRED',
    category: MediaCategory.IMAGE,
  },
  [LessonContentBlockType.VIDEO]: {
    mode: 'REQUIRED',
    category: MediaCategory.VIDEO,
  },
  [LessonContentBlockType.AUDIO]: {
    mode: 'REQUIRED',
    category: MediaCategory.AUDIO,
  },
  [LessonContentBlockType.PDF]: {
    mode: 'REQUIRED',
    category: MediaCategory.DOCUMENT,
    mimeType: 'application/pdf',
    extension: 'pdf',
  },
  [LessonContentBlockType.DOCUMENT]: {
    mode: 'REQUIRED',
    category: MediaCategory.DOCUMENT,
  },
  [LessonContentBlockType.DOWNLOAD]: {
    mode: 'REQUIRED',
    category: MediaCategory.DOCUMENT,
  },
};

export function mediaFileNotFound(): AppError {
  return new AppError('Media fayl topilmadi.', 404, 'MEDIA_FILE_NOT_FOUND');
}

export function assertLessonBlockMediaCompatibility(
  blockType: LessonContentBlockType,
  media: CompatibleMediaFile | null,
): void {
  const rule = mediaRules[blockType];

  if (rule.mode === 'FORBIDDEN') {
    if (media) {
      throw new AppError(
        'Bu kontent blok turiga media fayl biriktirish mumkin emas.',
        409,
        'MEDIA_NOT_ALLOWED_FOR_BLOCK',
      );
    }
    return;
  }

  if (!media) {
    throw new AppError(
      'Bu kontent blok turi uchun media fayl talab qilinadi.',
      409,
      'MEDIA_REQUIRED_FOR_BLOCK',
    );
  }

  if (media.deletedAt) {
    throw new AppError(
      'O‘chirilgan media faylni kontent blokiga biriktirib bo‘lmaydi.',
      409,
      'MEDIA_FILE_IS_DELETED',
    );
  }

  if (
    media.category !== rule.category ||
    (rule.mimeType !== undefined && media.mimeType !== rule.mimeType) ||
    (rule.extension !== undefined && media.extension !== rule.extension)
  ) {
    throw new AppError(
      'Media fayl turi kontent blok turiga mos emas.',
      409,
      'MEDIA_CATEGORY_MISMATCH',
    );
  }
}
