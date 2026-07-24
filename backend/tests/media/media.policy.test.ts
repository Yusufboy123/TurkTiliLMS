import { MediaCategory } from '@prisma/client';
import { resolveMediaTypePolicy } from '../../src/modules/media/media.policy.js';

describe('media type policy', () => {
  it.each([
    ['photo.jpg', 'image/jpeg', MediaCategory.IMAGE],
    ['photo.jpeg', 'image/jpeg', MediaCategory.IMAGE],
    ['photo.png', 'image/png', MediaCategory.IMAGE],
    ['photo.webp', 'image/webp', MediaCategory.IMAGE],
    ['document.pdf', 'application/pdf', MediaCategory.DOCUMENT],
    ['document.doc', 'application/msword', MediaCategory.DOCUMENT],
    [
      'document.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      MediaCategory.DOCUMENT,
    ],
    ['slides.ppt', 'application/vnd.ms-powerpoint', MediaCategory.DOCUMENT],
    [
      'slides.pptx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      MediaCategory.DOCUMENT,
    ],
    ['speech.mp3', 'audio/mpeg', MediaCategory.AUDIO],
    ['speech.wav', 'audio/wav', MediaCategory.AUDIO],
    ['lesson.mp4', 'video/mp4', MediaCategory.VIDEO],
  ])('accepts %s with its declared MIME type', (fileName, mimeType, category) => {
    expect(resolveMediaTypePolicy(fileName, mimeType).policy.category).toBe(category);
  });

  it('normalizes path-like original names to metadata-only base names', () => {
    expect(
      resolveMediaTypePolicy('../unsafe/path/lesson.pdf', 'application/pdf').originalFileName,
    ).toBe('lesson.pdf');
  });

  it('rejects a supported extension with a mismatched declared MIME type', () => {
    expect(() => resolveMediaTypePolicy('lesson.pdf', 'image/png')).toThrow(
      expect.objectContaining({ code: 'MEDIA_MIME_TYPE_MISMATCH' }),
    );
  });
});
