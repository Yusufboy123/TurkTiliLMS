import { LessonContentBlockType, MediaCategory, MediaStorageProvider } from '@prisma/client';
import { assertLessonBlockMediaCompatibility } from '../../src/modules/lesson-content-blocks/lesson-content-block.media-policy.js';
import { MEDIA_ID } from '../helpers/media-fakes.js';

function media(
  category: MediaCategory,
  overrides: Partial<{
    mimeType: string;
    extension: string;
    deletedAt: Date | null;
  }> = {},
) {
  return {
    id: MEDIA_ID,
    category,
    mimeType: 'application/octet-stream',
    extension: 'bin',
    storageProvider: MediaStorageProvider.LOCAL,
    deletedAt: null,
    ...overrides,
  };
}

describe('lesson content block media compatibility policy', () => {
  it.each([
    [LessonContentBlockType.IMAGE, MediaCategory.IMAGE, 'image/png', 'png'],
    [LessonContentBlockType.VIDEO, MediaCategory.VIDEO, 'video/mp4', 'mp4'],
    [LessonContentBlockType.AUDIO, MediaCategory.AUDIO, 'audio/mpeg', 'mp3'],
    [LessonContentBlockType.DOCUMENT, MediaCategory.DOCUMENT, 'application/msword', 'doc'],
    [LessonContentBlockType.DOWNLOAD, MediaCategory.DOCUMENT, 'application/pdf', 'pdf'],
    [LessonContentBlockType.PDF, MediaCategory.DOCUMENT, 'application/pdf', 'pdf'],
  ])('accepts compatible %s media', (blockType, category, mimeType, extension) => {
    expect(() =>
      assertLessonBlockMediaCompatibility(blockType, media(category, { mimeType, extension })),
    ).not.toThrow();
  });

  it.each([LessonContentBlockType.TEXT, LessonContentBlockType.LINK])(
    'forbids media on %s blocks',
    (blockType) => {
      expect(() =>
        assertLessonBlockMediaCompatibility(blockType, media(MediaCategory.IMAGE)),
      ).toThrowError(expect.objectContaining({ code: 'MEDIA_NOT_ALLOWED_FOR_BLOCK' }));
    },
  );

  it('requires media for managed binary block types', () => {
    expect(() =>
      assertLessonBlockMediaCompatibility(LessonContentBlockType.VIDEO, null),
    ).toThrowError(expect.objectContaining({ code: 'MEDIA_REQUIRED_FOR_BLOCK' }));
  });

  it('rejects deleted, wrong-category, and non-PDF document media', () => {
    expect(() =>
      assertLessonBlockMediaCompatibility(
        LessonContentBlockType.IMAGE,
        media(MediaCategory.IMAGE, { deletedAt: new Date() }),
      ),
    ).toThrowError(expect.objectContaining({ code: 'MEDIA_FILE_IS_DELETED' }));

    expect(() =>
      assertLessonBlockMediaCompatibility(LessonContentBlockType.AUDIO, media(MediaCategory.VIDEO)),
    ).toThrowError(expect.objectContaining({ code: 'MEDIA_CATEGORY_MISMATCH' }));

    expect(() =>
      assertLessonBlockMediaCompatibility(
        LessonContentBlockType.PDF,
        media(MediaCategory.DOCUMENT, {
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          extension: 'docx',
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: 'MEDIA_CATEGORY_MISMATCH' }));
  });
});
