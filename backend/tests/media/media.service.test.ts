import { LessonContentBlockType, RoleCode } from '@prisma/client';
import { MediaService } from '../../src/modules/media/media.service.js';
import {
  MEDIA_ID,
  OTHER_MEDIA_USER_ID,
  FakeMediaInspector,
  FakeMediaRepository,
  FakeMediaStorage,
  mediaActor,
  mediaAuditContext,
  mediaFile,
} from '../helpers/media-fakes.js';

const stagedUpload = {
  path: 'staging/upload.tmp',
  originalFileName: '  dars.png  ',
  declaredMimeType: 'image/png',
  sizeBytes: 67,
};

function setup() {
  const repository = new FakeMediaRepository();
  const storage = new FakeMediaStorage();
  const inspector = new FakeMediaInspector();
  return {
    repository,
    storage,
    service: new MediaService(repository, storage, inspector),
  };
}

describe('MediaService', () => {
  it('stores inspected media metadata while keeping storage paths private', async () => {
    const { service, repository } = setup();

    const result = await service.upload(stagedUpload, mediaActor(), mediaAuditContext);

    expect(result).toMatchObject({
      originalFileName: 'dars.png',
      storedFileName: 'stored.png',
      extension: 'png',
      mimeType: 'image/png',
      sizeBytes: '67',
    });
    expect(result).not.toHaveProperty('storagePath');
    expect(repository.lastCreateData).toMatchObject({
      uploadedById: mediaActor().userId,
      storagePath: 'images/stored.png',
      sizeBytes: 67n,
    });
  });

  it('rejects unsupported extensions and removes the staged upload', async () => {
    const { service, storage } = setup();

    await expect(
      service.upload(
        {
          ...stagedUpload,
          originalFileName: 'virus.exe',
          declaredMimeType: 'application/octet-stream',
        },
        mediaActor(),
        mediaAuditContext,
      ),
    ).rejects.toMatchObject({ code: 'MEDIA_EXTENSION_NOT_SUPPORTED' });

    expect(storage.discardedPaths).toEqual([stagedUpload.path]);
  });

  it('compensates the stored object when database persistence fails', async () => {
    const { service, repository, storage } = setup();
    repository.failCreate = true;

    await expect(service.upload(stagedUpload, mediaActor(), mediaAuditContext)).rejects.toThrow(
      'Database unavailable',
    );

    expect(storage.removedPaths).toEqual(['images/stored.png']);
    expect(storage.discardedPaths).toEqual([stagedUpload.path]);
  });

  it('allows an administrator to read metadata uploaded by another user', async () => {
    const { service } = setup();
    const result = await service.getById(
      MEDIA_ID,
      mediaActor({
        userId: OTHER_MEDIA_USER_ID,
        roles: [RoleCode.ADMIN],
        permissions: ['media.read'],
      }),
    );
    expect(result.id).toBe(MEDIA_ID);
  });

  it('hides another uploader media from a teacher', async () => {
    const { service } = setup();
    await expect(
      service.getById(
        MEDIA_ID,
        mediaActor({
          userId: OTHER_MEDIA_USER_ID,
          permissions: ['media.read'],
        }),
      ),
    ).rejects.toMatchObject({ code: 'MEDIA_FILE_NOT_FOUND' });
  });

  it('prevents download of a soft-deleted file', async () => {
    const repository = new FakeMediaRepository(mediaFile({ deletedAt: new Date() }));
    const service = new MediaService(repository, new FakeMediaStorage(), new FakeMediaInspector());

    await expect(
      service.download(MEDIA_ID, mediaActor({ permissions: ['media.download'] })),
    ).rejects.toMatchObject({ code: 'MEDIA_FILE_IS_DELETED' });
  });

  it('maps a missing stored object to a safe provider error', async () => {
    const { service, storage } = setup();
    storage.unavailable = true;

    await expect(
      service.download(MEDIA_ID, mediaActor({ permissions: ['media.download'] })),
    ).rejects.toMatchObject({ code: 'MEDIA_OBJECT_UNAVAILABLE', statusCode: 503 });
  });

  it('soft-deletes and restores owned media without removing the binary', async () => {
    const { service, repository, storage } = setup();

    await service.delete(
      MEDIA_ID,
      mediaActor({ permissions: ['media.delete'] }),
      mediaAuditContext,
    );
    expect(repository.current?.deletedAt).toBeInstanceOf(Date);
    expect(storage.removedPaths).toEqual([]);

    const restored = await service.restore(
      MEDIA_ID,
      mediaActor({ permissions: ['media.restore'] }),
      mediaAuditContext,
    );
    expect(restored.deletedAt).toBeNull();
  });

  it('blocks deletion while active lesson content references the media', async () => {
    const { service, repository } = setup();
    repository.usages = [
      {
        type: 'LESSON_CONTENT_BLOCK',
        block: {
          id: '019b9e23-3b3a-7909-a2c1-0948f9e15717',
          blockType: LessonContentBlockType.IMAGE,
          title: 'Rasm',
          position: 1,
        },
        lesson: {
          id: '019b9e23-1f4f-7b2d-b9b7-2f0fa34b3c51',
          title: 'Salomlashish',
          slug: 'salomlashish',
        },
        course: {
          id: '019b9e23-0f3f-7b2d-b9b7-2f0fa34b3c50',
          title: 'Turk tili A1',
          slug: 'turk-tili-a1',
        },
      },
    ];

    await expect(
      service.delete(MEDIA_ID, mediaActor({ permissions: ['media.delete'] }), mediaAuditContext),
    ).rejects.toMatchObject({
      code: 'MEDIA_IN_USE',
      statusCode: 409,
      details: {
        activeUsageCount: 1,
      },
    });
    expect(repository.current?.deletedAt).toBeNull();
  });

  it('lists active usages for soft-deleted media during admin workflows', async () => {
    const repository = new FakeMediaRepository(mediaFile({ deletedAt: new Date() }));
    repository.usages = [
      {
        type: 'LESSON_CONTENT_BLOCK',
        block: {
          id: '019b9e23-3b3a-7909-a2c1-0948f9e15717',
          blockType: LessonContentBlockType.PDF,
          title: null,
          position: 2,
        },
        lesson: {
          id: '019b9e23-1f4f-7b2d-b9b7-2f0fa34b3c51',
          title: 'Hujjat',
          slug: 'hujjat',
        },
        course: {
          id: '019b9e23-0f3f-7b2d-b9b7-2f0fa34b3c50',
          title: 'Turk tili A1',
          slug: 'turk-tili-a1',
        },
      },
    ];
    const service = new MediaService(repository, new FakeMediaStorage(), new FakeMediaInspector());

    await expect(
      service.usages(MEDIA_ID, mediaActor({ permissions: ['media.read'] })),
    ).resolves.toMatchObject({
      mediaFileId: MEDIA_ID,
      activeOnly: true,
      totalItems: 1,
      truncated: false,
    });
  });

  it('enforces service-level permission checks', async () => {
    const { service } = setup();
    await expect(service.getById(MEDIA_ID, mediaActor({ permissions: [] }))).rejects.toMatchObject({
      code: 'ACCESS_DENIED',
    });
  });
});
