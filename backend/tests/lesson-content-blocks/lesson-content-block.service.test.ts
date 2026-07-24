import {
  LessonContentBlockType,
  LessonType,
  MediaCategory,
  RoleCode,
  SessionClientType,
} from '@prisma/client';
import { LessonBlockPositionConflictError } from '../../src/modules/lesson-content-blocks/lesson-content-block.repository.js';
import { MetadataOnlyLessonContentBlockDelivery } from '../../src/modules/lesson-content-blocks/lesson-content-block.storage.js';
import { LessonContentBlockService } from '../../src/modules/lesson-content-blocks/lesson-content-block.service.js';
import {
  EnrollmentPendingLessonAccessPolicy,
  LessonManagementService,
} from '../../src/modules/lessons/lesson-management.service.js';
import { AppError } from '../../src/utils/app-error.js';
import {
  adminBlockActor,
  BLOCK_ONE_ID,
  BLOCK_THREE_ID,
  BLOCK_TWO_ID,
  blockAuditContext,
  contentBlock,
  FakeLessonContentBlockRepository,
  teacherBlockActor,
} from '../helpers/lesson-content-block-fakes.js';
import {
  COURSE_TEACHER_ID,
  createCourseRecord,
  FakeCourseRepository,
  TEST_COURSE_ID,
} from '../helpers/course-fakes.js';
import { FakeLessonRepository, LESSON_ID, SECTION_ID, lesson } from '../helpers/lesson-fakes.js';
import { MEDIA_ID, publicMediaReference } from '../helpers/media-fakes.js';

function setup(blocks = [contentBlock()], course = createCourseRecord()) {
  const blockRepository = new FakeLessonContentBlockRepository(blocks);
  const lessonRepository = new FakeLessonRepository();
  const parentService = new LessonManagementService(
    lessonRepository,
    new FakeCourseRepository([course]),
    new EnrollmentPendingLessonAccessPolicy(),
  );
  return {
    blockRepository,
    lessonRepository,
    service: new LessonContentBlockService(
      blockRepository,
      parentService,
      new MetadataOnlyLessonContentBlockDelivery(),
    ),
  };
}

function orderedBlocks() {
  return [
    contentBlock({ id: BLOCK_ONE_ID, position: 1 }),
    contentBlock({
      id: BLOCK_TWO_ID,
      position: 2,
      title: 'Ikkinchi blok',
    }),
    contentBlock({
      id: BLOCK_THREE_ID,
      position: 3,
      title: 'Uchinchi blok',
    }),
  ];
}

function expectCode(error: unknown, code: string): boolean {
  expect(error).toBeInstanceOf(AppError);
  expect(error).toMatchObject({ code });
  return true;
}

describe('LessonContentBlockService ordering', () => {
  it('appends a block when position is omitted', async () => {
    const { blockRepository, service } = setup(orderedBlocks());

    const created = await service.create(
      TEST_COURSE_ID,
      LESSON_ID,
      {
        blockType: LessonContentBlockType.TEXT,
        textContent: 'Yangi matn',
        isRequired: true,
        isVisible: true,
      },
      teacherBlockActor,
      blockAuditContext,
    );

    expect(created.position).toBe(4);
    expect(blockRepository.lastCreateData?.position).toBeUndefined();
  });

  it('inserts a block at a requested position and shifts siblings', async () => {
    const { blockRepository, service } = setup(orderedBlocks());

    const created = await service.create(
      TEST_COURSE_ID,
      LESSON_ID,
      {
        blockType: LessonContentBlockType.TEXT,
        textContent: 'Oraga qo‘shilgan matn',
        position: 2,
        isRequired: true,
        isVisible: true,
      },
      adminBlockActor,
      blockAuditContext,
    );

    expect(created.position).toBe(2);
    expect(
      [...blockRepository.blocks.values()]
        .filter((block) => !block.deletedAt)
        .map((block) => block.position)
        .sort(),
    ).toEqual([1, 2, 3, 4]);
  });

  it('maps a duplicate active position conflict safely', async () => {
    const { blockRepository, service } = setup();
    blockRepository.create = () => Promise.reject(new LessonBlockPositionConflictError());

    await expect(
      service.create(
        TEST_COURSE_ID,
        LESSON_ID,
        {
          blockType: LessonContentBlockType.TEXT,
          textContent: 'Yangi matn',
          isRequired: true,
          isVisible: true,
        },
        teacherBlockActor,
        blockAuditContext,
      ),
    ).rejects.toSatisfy((error: unknown) => expectCode(error, 'LESSON_BLOCK_POSITION_CONFLICT'));
  });

  it('reorders forward and backward without position gaps', async () => {
    const { blockRepository, service } = setup(orderedBlocks());

    await service.reorder(
      TEST_COURSE_ID,
      LESSON_ID,
      BLOCK_ONE_ID,
      3,
      teacherBlockActor,
      blockAuditContext,
    );
    expect(blockRepository.blocks.get(BLOCK_ONE_ID)?.position).toBe(3);

    await service.reorder(
      TEST_COURSE_ID,
      LESSON_ID,
      BLOCK_ONE_ID,
      1,
      teacherBlockActor,
      blockAuditContext,
    );

    expect([...blockRepository.blocks.values()].map((block) => block.position).sort()).toEqual([
      1, 2, 3,
    ]);
    expect(blockRepository.blocks.get(BLOCK_ONE_ID)?.position).toBe(1);
  });

  it('closes the active position gap after soft deletion', async () => {
    const { blockRepository, service } = setup(orderedBlocks());

    await service.delete(
      TEST_COURSE_ID,
      LESSON_ID,
      BLOCK_TWO_ID,
      teacherBlockActor,
      blockAuditContext,
    );

    expect(blockRepository.blocks.get(BLOCK_TWO_ID)?.deletedAt).toBeInstanceOf(Date);
    expect(blockRepository.blocks.get(BLOCK_THREE_ID)?.position).toBe(2);
  });

  it('restores at the end when position is omitted', async () => {
    const deleted = contentBlock({
      id: BLOCK_TWO_ID,
      position: 2,
      deletedAt: new Date(),
    });
    const { service } = setup([contentBlock({ id: BLOCK_ONE_ID, position: 1 }), deleted]);

    const restored = await service.restore(
      TEST_COURSE_ID,
      LESSON_ID,
      BLOCK_TWO_ID,
      undefined,
      teacherBlockActor,
      blockAuditContext,
    );

    expect(restored).toMatchObject({ position: 2, deletedAt: null });
  });

  it('restores at a requested position and shifts siblings', async () => {
    const { blockRepository, service } = setup([
      contentBlock({ id: BLOCK_ONE_ID, position: 1 }),
      contentBlock({ id: BLOCK_THREE_ID, position: 2 }),
      contentBlock({
        id: BLOCK_TWO_ID,
        position: 2,
        deletedAt: new Date(),
      }),
    ]);

    const restored = await service.restore(
      TEST_COURSE_ID,
      LESSON_ID,
      BLOCK_TWO_ID,
      1,
      teacherBlockActor,
      blockAuditContext,
    );

    expect(restored.position).toBe(1);
    expect(
      [...blockRepository.blocks.values()]
        .filter((block) => !block.deletedAt)
        .map((block) => block.position)
        .sort(),
    ).toEqual([1, 2, 3]);
  });
});

describe('LessonContentBlockService validation and authorization', () => {
  it('allows admins and assigned teachers', async () => {
    const { service } = setup();
    const query = {
      page: 1,
      pageSize: 50,
      includeDeleted: false,
    };

    await expect(
      service.list(TEST_COURSE_ID, LESSON_ID, query, adminBlockActor),
    ).resolves.toBeDefined();
    await expect(
      service.list(TEST_COURSE_ID, LESSON_ID, query, teacherBlockActor),
    ).resolves.toBeDefined();
  });

  it('denies an unrelated teacher', async () => {
    const { service } = setup(
      [contentBlock()],
      createCourseRecord({
        teacher: {
          id: '019b9e23-78bd-7197-a791-b5c87432ebea',
          firstName: null,
          lastName: null,
          displayName: null,
        },
      }),
    );

    await expect(
      service.detail(TEST_COURSE_ID, LESSON_ID, BLOCK_ONE_ID, teacherBlockActor),
    ).rejects.toSatisfy((error: unknown) => expectCode(error, 'COURSE_SCOPE_DENIED'));
  });

  it('denies students from management services', async () => {
    const { service } = setup();

    await expect(
      service.list(
        TEST_COURSE_ID,
        LESSON_ID,
        { page: 1, pageSize: 50, includeDeleted: false },
        {
          userId: COURSE_TEACHER_ID,
          roles: [RoleCode.STUDENT],
          permissions: [],
        },
      ),
    ).rejects.toSatisfy((error: unknown) => expectCode(error, 'ACCESS_DENIED'));
  });

  it('requires managed media when block type changes to PDF', async () => {
    const { service } = setup();

    await expect(
      service.update(
        TEST_COURSE_ID,
        LESSON_ID,
        BLOCK_ONE_ID,
        {
          blockType: LessonContentBlockType.PDF,
          textContent: null,
        },
        teacherBlockActor,
        blockAuditContext,
      ),
    ).rejects.toSatisfy((error: unknown) => expectCode(error, 'MEDIA_REQUIRED_FOR_BLOCK'));
  });

  it('creates a block with an active compatible media relation', async () => {
    const { blockRepository, service } = setup();
    blockRepository.mediaReferences.set(
      MEDIA_ID,
      publicMediaReference({
        category: MediaCategory.VIDEO,
        mimeType: 'video/mp4',
        extension: 'mp4',
      }),
    );

    const created = await service.create(
      TEST_COURSE_ID,
      LESSON_ID,
      {
        blockType: LessonContentBlockType.VIDEO,
        mediaFileId: MEDIA_ID,
        isRequired: true,
        isVisible: true,
      },
      teacherBlockActor,
      blockAuditContext,
    );

    expect(created).toMatchObject({
      blockType: LessonContentBlockType.VIDEO,
      mediaFileId: MEDIA_ID,
      media: { id: MEDIA_ID, category: MediaCategory.VIDEO },
    });
  });

  it('rejects a missing, deleted, or incompatible media relation', async () => {
    const { blockRepository, service } = setup();

    await expect(
      service.create(
        TEST_COURSE_ID,
        LESSON_ID,
        {
          blockType: LessonContentBlockType.IMAGE,
          mediaFileId: MEDIA_ID,
          isRequired: true,
          isVisible: true,
        },
        teacherBlockActor,
        blockAuditContext,
      ),
    ).rejects.toSatisfy((error: unknown) => expectCode(error, 'MEDIA_FILE_NOT_FOUND'));

    blockRepository.mediaReferences.set(
      MEDIA_ID,
      publicMediaReference({ deletedAt: new Date('2026-01-02T00:00:00.000Z') }),
    );
    await expect(
      service.create(
        TEST_COURSE_ID,
        LESSON_ID,
        {
          blockType: LessonContentBlockType.IMAGE,
          mediaFileId: MEDIA_ID,
          isRequired: true,
          isVisible: true,
        },
        teacherBlockActor,
        blockAuditContext,
      ),
    ).rejects.toSatisfy((error: unknown) => expectCode(error, 'MEDIA_FILE_IS_DELETED'));

    blockRepository.mediaReferences.set(MEDIA_ID, publicMediaReference());
    await expect(
      service.create(
        TEST_COURSE_ID,
        LESSON_ID,
        {
          blockType: LessonContentBlockType.AUDIO,
          mediaFileId: MEDIA_ID,
          isRequired: true,
          isVisible: true,
        },
        teacherBlockActor,
        blockAuditContext,
      ),
    ).rejects.toSatisfy((error: unknown) => expectCode(error, 'MEDIA_CATEGORY_MISMATCH'));
  });

  it('preserves omitted media and requires explicit clearing for a TEXT transition', async () => {
    const media = publicMediaReference({
      category: MediaCategory.VIDEO,
      mimeType: 'video/mp4',
      extension: 'mp4',
    });
    const { service } = setup([
      contentBlock({
        blockType: LessonContentBlockType.VIDEO,
        mediaFileId: MEDIA_ID,
        media,
        textContent: null,
      }),
    ]);

    await expect(
      service.update(
        TEST_COURSE_ID,
        LESSON_ID,
        BLOCK_ONE_ID,
        { blockType: LessonContentBlockType.TEXT, textContent: 'Yangi matn' },
        teacherBlockActor,
        blockAuditContext,
      ),
    ).rejects.toSatisfy((error: unknown) => expectCode(error, 'MEDIA_NOT_ALLOWED_FOR_BLOCK'));

    await expect(
      service.update(
        TEST_COURSE_ID,
        LESSON_ID,
        BLOCK_ONE_ID,
        {
          blockType: LessonContentBlockType.TEXT,
          mediaFileId: null,
          textContent: 'Yangi matn',
        },
        teacherBlockActor,
        blockAuditContext,
      ),
    ).resolves.toMatchObject({
      blockType: LessonContentBlockType.TEXT,
      mediaFileId: null,
      media: null,
    });
  });

  it('preserves an existing compatible media relation when mediaFileId is omitted', async () => {
    const media = publicMediaReference();
    const { service } = setup([
      contentBlock({
        blockType: LessonContentBlockType.IMAGE,
        mediaFileId: MEDIA_ID,
        media,
        textContent: null,
      }),
    ]);

    await expect(
      service.update(
        TEST_COURSE_ID,
        LESSON_ID,
        BLOCK_ONE_ID,
        { title: 'Yangilangan rasm' },
        teacherBlockActor,
        blockAuditContext,
      ),
    ).resolves.toMatchObject({
      title: 'Yangilangan rasm',
      mediaFileId: MEDIA_ID,
      media: { id: MEDIA_ID },
    });
  });

  it('rejects removal when the final block type still requires media', async () => {
    const media = publicMediaReference();
    const { service } = setup([
      contentBlock({
        blockType: LessonContentBlockType.IMAGE,
        mediaFileId: MEDIA_ID,
        media,
        textContent: null,
      }),
    ]);

    await expect(
      service.update(
        TEST_COURSE_ID,
        LESSON_ID,
        BLOCK_ONE_ID,
        { mediaFileId: null },
        teacherBlockActor,
        blockAuditContext,
      ),
    ).rejects.toSatisfy((error: unknown) => expectCode(error, 'MEDIA_REQUIRED_FOR_BLOCK'));
  });

  it('prevents restoring a block whose related media was soft-deleted', async () => {
    const { service } = setup([
      contentBlock({
        blockType: LessonContentBlockType.IMAGE,
        mediaFileId: MEDIA_ID,
        media: publicMediaReference({ deletedAt: new Date() }),
        textContent: null,
        deletedAt: new Date(),
      }),
    ]);

    await expect(
      service.restore(
        TEST_COURSE_ID,
        LESSON_ID,
        BLOCK_ONE_ID,
        undefined,
        teacherBlockActor,
        blockAuditContext,
      ),
    ).rejects.toSatisfy((error: unknown) => expectCode(error, 'MEDIA_FILE_IS_DELETED'));
  });

  it('updates visibility with its dedicated permission', async () => {
    const { service } = setup();
    const updated = await service.updateVisibility(
      TEST_COURSE_ID,
      LESSON_ID,
      BLOCK_ONE_ID,
      false,
      teacherBlockActor,
      blockAuditContext,
    );
    expect(updated.isVisible).toBe(false);
  });

  it('rejects a block that does not belong to the lesson', async () => {
    const { service } = setup([
      contentBlock({
        lessonId: '019b9e23-8c5d-72fa-bda8-a159c6ca3078',
      }),
    ]);

    await expect(
      service.detail(TEST_COURSE_ID, LESSON_ID, BLOCK_ONE_ID, teacherBlockActor),
    ).rejects.toSatisfy((error: unknown) => expectCode(error, 'LESSON_BLOCK_NOT_FOUND'));
  });

  it('rejects a lesson that does not belong to the course', async () => {
    const { lessonRepository, service } = setup();
    lessonRepository.currentLesson = null;

    await expect(
      service.detail(TEST_COURSE_ID, LESSON_ID, BLOCK_ONE_ID, teacherBlockActor),
    ).rejects.toSatisfy((error: unknown) => expectCode(error, 'LESSON_NOT_FOUND'));
  });

  it.each([
    ['deleted course', 'COURSE_IS_DELETED'],
    ['deleted section', 'SECTION_IS_DELETED'],
    ['deleted lesson', 'LESSON_IS_DELETED'],
  ])('rejects management under a %s', async (parent, code) => {
    const course =
      parent === 'deleted course'
        ? createCourseRecord({ deletedAt: new Date() })
        : createCourseRecord();
    const { lessonRepository, service } = setup([contentBlock()], course);
    if (parent === 'deleted section') {
      lessonRepository.currentLesson = lesson({
        section: { ...lesson().section, deletedAt: new Date() },
      });
    }
    if (parent === 'deleted lesson') {
      lessonRepository.currentLesson = lesson({
        deletedAt: new Date(),
      });
    }

    await expect(
      service.detail(TEST_COURSE_ID, LESSON_ID, BLOCK_ONE_ID, adminBlockActor),
    ).rejects.toSatisfy((error: unknown) => expectCode(error, code));
  });
});

describe('LessonContentBlockService catalog', () => {
  it('returns only active visible blocks in position order for a preview lesson', async () => {
    const { lessonRepository, service } = setup([
      contentBlock({
        id: BLOCK_ONE_ID,
        position: 2,
        title: 'Ikkinchi',
      }),
      contentBlock({
        id: BLOCK_TWO_ID,
        position: 1,
        title: 'Birinchi',
      }),
      contentBlock({
        id: BLOCK_THREE_ID,
        position: 3,
        isVisible: false,
      }),
      contentBlock({
        id: '019b9e23-9e98-73e7-8e15-c8e19c2b2cef',
        position: 4,
        deletedAt: new Date(),
      }),
    ]);
    lessonRepository.catalogLessonResult = {
      id: LESSON_ID,
      courseId: TEST_COURSE_ID,
      title: 'Preview',
      slug: 'preview',
      summary: null,
      content: null,
      lessonType: LessonType.TEXT,
      durationMinutes: 10,
      isPreview: true,
      publishedAt: new Date(),
      section: { id: SECTION_ID, title: 'Kirish' },
    };

    const result = await service.catalog('kurs', 'preview', null);

    expect(result.map((block) => block.title)).toEqual(['Birinchi', 'Ikkinchi']);
    expect(result[0]).not.toHaveProperty('createdById');
    expect(result[0]).not.toHaveProperty('metadata');
  });

  it('keeps non-preview lesson blocks fail-closed', async () => {
    const { lessonRepository, service } = setup();
    lessonRepository.catalogLessonResult = {
      id: LESSON_ID,
      courseId: TEST_COURSE_ID,
      title: 'Yopiq dars',
      slug: 'yopiq-dars',
      summary: null,
      content: null,
      lessonType: LessonType.TEXT,
      durationMinutes: 10,
      isPreview: false,
      publishedAt: new Date(),
      section: { id: SECTION_ID, title: 'Kirish' },
    };

    await expect(service.catalog('kurs', 'yopiq-dars', null)).rejects.toSatisfy((error: unknown) =>
      expectCode(error, 'LESSON_AUTHENTICATION_REQUIRED'),
    );

    await expect(
      service.catalog('kurs', 'yopiq-dars', {
        userId: COURSE_TEACHER_ID,
        sessionId: '019b9e23-ae7e-7b0a-a056-f1740dacbb46',
        clientType: SessionClientType.WEB,
        roles: [RoleCode.STUDENT],
        permissions: [],
      }),
    ).rejects.toSatisfy((error: unknown) => expectCode(error, 'LESSON_ENROLLMENT_REQUIRED'));
  });
});
