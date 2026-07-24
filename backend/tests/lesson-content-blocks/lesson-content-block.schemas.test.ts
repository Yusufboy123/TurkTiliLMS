import { LessonContentBlockType } from '@prisma/client';
import { createLessonContentBlockSchema } from '../../src/modules/lesson-content-blocks/lesson-content-block.schemas.js';

describe('Lesson content block validation', () => {
  it.each([
    [LessonContentBlockType.TEXT, { textContent: 'Salomlashish matni' }],
    [
      LessonContentBlockType.VIDEO,
      {
        sourceUrl: 'https://video.example.com/lesson',
        mimeType: 'video/mp4',
      },
    ],
    [
      LessonContentBlockType.AUDIO,
      {
        fileUrl: 'https://cdn.example.com/audio.mp3',
        mimeType: 'audio/mpeg',
      },
    ],
    [
      LessonContentBlockType.PDF,
      {
        fileUrl: 'https://cdn.example.com/lesson.pdf',
        mimeType: 'application/pdf',
      },
    ],
    [
      LessonContentBlockType.DOCUMENT,
      {
        fileUrl: 'https://cdn.example.com/lesson.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
    ],
    [
      LessonContentBlockType.IMAGE,
      {
        fileUrl: 'https://cdn.example.com/image.webp',
        mimeType: 'image/webp',
      },
    ],
    [LessonContentBlockType.LINK, { sourceUrl: 'https://example.com/reference' }],
    [LessonContentBlockType.DOWNLOAD, { fileUrl: 'https://cdn.example.com/resource.zip' }],
  ])('accepts valid %s content', (blockType, content) => {
    expect(
      createLessonContentBlockSchema.safeParse({
        blockType,
        ...content,
      }).success,
    ).toBe(true);
  });

  it.each([LessonContentBlockType.TEXT, LessonContentBlockType.LINK])(
    'rejects %s when its required content is absent',
    (blockType) => {
      expect(createLessonContentBlockSchema.safeParse({ blockType }).success).toBe(false);
    },
  );

  it('accepts UUID media references and rejects malformed identifiers', () => {
    expect(
      createLessonContentBlockSchema.safeParse({
        blockType: LessonContentBlockType.IMAGE,
        mediaFileId: '019b9e24-1147-7f4b-9726-e46482877c65',
      }).success,
    ).toBe(true);
    expect(
      createLessonContentBlockSchema.safeParse({
        blockType: LessonContentBlockType.IMAGE,
        mediaFileId: 'not-a-uuid',
      }).success,
    ).toBe(false);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,unsafe',
    'file:///etc/passwd',
    'https://user:secret@example.com/private',
  ])('rejects unsafe URL %s', (sourceUrl) => {
    expect(
      createLessonContentBlockSchema.safeParse({
        blockType: LessonContentBlockType.LINK,
        sourceUrl,
      }).success,
    ).toBe(false);
  });

  it('rejects invalid media MIME types', () => {
    expect(
      createLessonContentBlockSchema.safeParse({
        blockType: LessonContentBlockType.PDF,
        fileUrl: 'https://cdn.example.com/file.pdf',
        mimeType: 'text/html',
      }).success,
    ).toBe(false);
    expect(
      createLessonContentBlockSchema.safeParse({
        blockType: LessonContentBlockType.IMAGE,
        fileUrl: 'https://cdn.example.com/file.svg',
        mimeType: 'image/svg+xml',
      }).success,
    ).toBe(false);
  });

  it('rejects invalid file size and duration values', () => {
    expect(
      createLessonContentBlockSchema.safeParse({
        blockType: LessonContentBlockType.AUDIO,
        fileUrl: 'https://cdn.example.com/audio.mp3',
        fileSizeBytes: 0,
        durationSeconds: -1,
      }).success,
    ).toBe(false);
    expect(
      createLessonContentBlockSchema.safeParse({
        blockType: LessonContentBlockType.DOWNLOAD,
        fileUrl: 'https://cdn.example.com/archive.zip',
        fileSizeBytes: '999999999999999999999999',
      }).success,
    ).toBe(false);
  });
});
