import {
  LessonContentBlockType,
  LessonStatus,
  LessonType,
  MediaCategory,
  MediaStorageProvider,
  Prisma,
  PrismaClient,
  type Prisma as PrismaTypes,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const rollback = new Error('ROLLBACK_TEST_TRANSACTION');

interface Fixture {
  actorId: string;
  lessonId: string;
  mediaFileId: string;
}

interface MediaDefinition {
  category: MediaCategory;
  extension: string;
  mimeType: string;
}

function databaseClient(): PrismaClient {
  if (!databaseUrl) {
    throw new Error('TEST_DATABASE_URL is required for PostgreSQL integration tests.');
  }
  return new PrismaClient({
    datasources: {
      db: { url: databaseUrl },
    },
  });
}

const integrationClient = databaseUrl ? databaseClient() : null;

function connectedClient(): PrismaClient {
  if (!integrationClient) {
    throw new Error('TEST_DATABASE_URL is required for PostgreSQL integration tests.');
  }
  return integrationClient;
}

async function createFixture(
  transaction: PrismaTypes.TransactionClient,
  media: MediaDefinition,
): Promise<Fixture> {
  const suffix = randomUUID();
  const actorId = randomUUID();
  const courseId = randomUUID();
  const sectionId = randomUUID();
  const lessonId = randomUUID();
  const mediaFileId = randomUUID();

  await transaction.user.create({
    data: {
      id: actorId,
      email: `constraint-${suffix}@example.test`,
      displayName: 'Constraint Integration Test',
    },
  });
  await transaction.course.create({
    data: {
      id: courseId,
      title: 'Constraint integration course',
      slug: `constraint-course-${suffix}`,
      createdByUserId: actorId,
    },
  });
  await transaction.courseSection.create({
    data: {
      id: sectionId,
      courseId,
      title: 'Constraint integration section',
      position: 1,
      createdById: actorId,
    },
  });
  await transaction.lesson.create({
    data: {
      id: lessonId,
      courseId,
      sectionId,
      title: 'Constraint integration lesson',
      slug: `constraint-lesson-${suffix}`,
      lessonType: LessonType.TEXT,
      status: LessonStatus.DRAFT,
      position: 1,
      createdById: actorId,
    },
  });
  await transaction.mediaFile.create({
    data: {
      id: mediaFileId,
      originalFileName: `fixture.${media.extension}`,
      storedFileName: `${suffix}.${media.extension}`,
      mimeType: media.mimeType,
      extension: media.extension,
      category: media.category,
      sizeBytes: 1n,
      storagePath: `integration/${suffix}.${media.extension}`,
      storageProvider: MediaStorageProvider.LOCAL,
      uploadedById: actorId,
    },
  });

  return { actorId, lessonId, mediaFileId };
}

async function withRollback(
  client: PrismaClient,
  operation: (transaction: PrismaTypes.TransactionClient) => Promise<void>,
): Promise<void> {
  try {
    await client.$transaction(async (transaction) => {
      await operation(transaction);
      throw rollback;
    });
  } catch (error: unknown) {
    if (error !== rollback) throw error;
  }
}

function expectRequiredContentConstraint(error: unknown): boolean {
  const details =
    error instanceof Prisma.PrismaClientKnownRequestError
      ? `${error.message} ${JSON.stringify(error.meta)}`
      : String(error);
  expect(details).toContain('23514');
  expect(details).toContain('lesson_content_blocks_required_content_check');
  return true;
}

describeDatabase('lesson content block PostgreSQL CHECK constraint', () => {
  beforeAll(async () => {
    await connectedClient().$connect();
  });

  afterAll(async () => {
    await connectedClient().$disconnect();
  });

  it.each([
    [
      LessonContentBlockType.VIDEO,
      { category: MediaCategory.VIDEO, extension: 'mp4', mimeType: 'video/mp4' },
    ],
    [
      LessonContentBlockType.IMAGE,
      { category: MediaCategory.IMAGE, extension: 'png', mimeType: 'image/png' },
    ],
    [
      LessonContentBlockType.AUDIO,
      { category: MediaCategory.AUDIO, extension: 'mp3', mimeType: 'audio/mpeg' },
    ],
    [
      LessonContentBlockType.PDF,
      {
        category: MediaCategory.DOCUMENT,
        extension: 'pdf',
        mimeType: 'application/pdf',
      },
    ],
    [
      LessonContentBlockType.DOCUMENT,
      {
        category: MediaCategory.DOCUMENT,
        extension: 'docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
    ],
    [
      LessonContentBlockType.DOWNLOAD,
      {
        category: MediaCategory.DOCUMENT,
        extension: 'pdf',
        mimeType: 'application/pdf',
      },
    ],
  ] satisfies Array<[LessonContentBlockType, MediaDefinition]>)(
    'inserts a media-backed %s block without duplicated legacy file fields',
    async (blockType, media) => {
      await withRollback(connectedClient(), async (transaction) => {
        const fixture = await createFixture(transaction, media);
        const created = await transaction.lessonContentBlock.create({
          data: {
            lessonId: fixture.lessonId,
            mediaFileId: fixture.mediaFileId,
            blockType,
            position: 1,
            createdById: fixture.actorId,
          },
        });

        expect(created).toMatchObject({
          blockType,
          mediaFileId: fixture.mediaFileId,
          fileUrl: null,
          sourceUrl: null,
        });
      });
    },
  );

  it('rejects a media-backed block type without mediaFileId', async () => {
    await expect(
      connectedClient().$transaction(async (transaction) => {
        const fixture = await createFixture(transaction, {
          category: MediaCategory.VIDEO,
          extension: 'mp4',
          mimeType: 'video/mp4',
        });
        await transaction.lessonContentBlock.create({
          data: {
            lessonId: fixture.lessonId,
            blockType: LessonContentBlockType.VIDEO,
            position: 1,
            createdById: fixture.actorId,
          },
        });
      }),
    ).rejects.toSatisfy(expectRequiredContentConstraint);
  });

  it.each([
    [LessonContentBlockType.TEXT, { textContent: 'Eski matn bloki' }],
    [LessonContentBlockType.LINK, { sourceUrl: 'https://example.com/resource' }],
  ] satisfies Array<
    [
      LessonContentBlockType,
      {
        textContent?: string;
        sourceUrl?: string;
      },
    ]
  >)('rejects mediaFileId on %s blocks', async (blockType, content) => {
    await expect(
      connectedClient().$transaction(async (transaction) => {
        const fixture = await createFixture(transaction, {
          category: MediaCategory.IMAGE,
          extension: 'png',
          mimeType: 'image/png',
        });
        await transaction.lessonContentBlock.create({
          data: {
            lessonId: fixture.lessonId,
            mediaFileId: fixture.mediaFileId,
            blockType,
            position: 1,
            createdById: fixture.actorId,
            ...content,
          },
        });
      }),
    ).rejects.toSatisfy(expectRequiredContentConstraint);
  });

  it.each([
    [LessonContentBlockType.TEXT, { textContent: 'Oddiy matn bloki' }],
    [LessonContentBlockType.LINK, { sourceUrl: 'https://example.com/resource' }],
  ] satisfies Array<
    [
      LessonContentBlockType,
      {
        textContent?: string;
        sourceUrl?: string;
      },
    ]
  >)('continues to insert valid non-media %s blocks', async (blockType, content) => {
    await withRollback(connectedClient(), async (transaction) => {
      const fixture = await createFixture(transaction, {
        category: MediaCategory.IMAGE,
        extension: 'png',
        mimeType: 'image/png',
      });
      const created = await transaction.lessonContentBlock.create({
        data: {
          lessonId: fixture.lessonId,
          blockType,
          position: 1,
          createdById: fixture.actorId,
          ...content,
        },
      });
      expect(created.mediaFileId).toBeNull();
    });
  });

  it('exposes the corrected real PostgreSQL constraint definition', async () => {
    const constraints = await connectedClient().$queryRaw<
      Array<{ convalidated: boolean; definition: string }>
    >(Prisma.sql`
      SELECT
        convalidated,
        pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid = 'lesson_content_blocks'::regclass
        AND conname = 'lesson_content_blocks_required_content_check'
    `);

    expect(constraints).toHaveLength(1);
    expect(constraints[0]?.convalidated).toBe(false);
    expect(constraints[0]?.definition).toContain('media_file_id IS NOT NULL');
    expect(constraints[0]?.definition).toContain('media_file_id IS NULL');
    expect(constraints[0]?.definition).not.toContain('file_url IS NOT NULL');
  });
});
