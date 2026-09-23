import 'dotenv/config';
import {
  CourseLevel,
  CourseStatus,
  LessonStatus,
  LessonType,
  PrismaClient,
  RoleCode,
  UserStatus,
  type LessonContentBlockType,
  type Prisma,
} from '@prisma/client';
import {
  A1_MASTERY_PASSING_PERCENTAGE,
  a1CourseDefinition,
  a1LessonDefinitions,
  a1SectionDefinition,
} from './a1-content.js';

const prisma = new PrismaClient();
const temporaryVocabularyTerms = ['alfabe', 'harf', 'ünlü', 'ünsüz', 'kalın', 'ince', 'ses', 'şeker', 'gün', 'dağ', 'merhaba', 'selam', 'ad', 'tanışmak', 'memnun', 'yaş', 'milliyet', 'Özbekistanlı', 'gözlük', 'ne', 'kim', 'çoğul', 'değil'];
const shouldSeedVocabulary = process.env.A1_SEED_VOCABULARY === 'true';

async function findContentTeacher() {
  const configuredEmail = process.env.A1_CONTENT_TEACHER_EMAIL?.trim();
  const where = {
    status: UserStatus.ACTIVE,
    deletedAt: null,
    roles: { some: { role: { code: RoleCode.TEACHER } } },
    ...(configuredEmail ? { email: configuredEmail } : {}),
  };
  const teacher = await prisma.user.findFirst({ where, orderBy: { createdAt: 'asc' }, select: { id: true, email: true } });
  if (!teacher) {
    throw new Error(configuredEmail
      ? `A1 content teacher not found for A1_CONTENT_TEACHER_EMAIL=${configuredEmail}`
      : 'No active Teacher is available for A1 content. Set A1_CONTENT_TEACHER_EMAIL or seed a Teacher first.');
  }
  return teacher;
}

async function seedLesson(tx: Prisma.TransactionClient, courseId: string, sectionId: string, teacherId: string, definition: (typeof a1LessonDefinitions)[number]) {
  const lesson = await tx.lesson.upsert({
    where: { courseId_slug: { courseId, slug: definition.slug } },
    create: {
      courseId,
      sectionId,
      title: definition.title,
      slug: definition.slug,
      summary: definition.summary,
      lessonType: LessonType.TEXT,
      position: definition.day,
      durationMinutes: definition.durationMinutes,
      isPreview: false,
      masteryEnabled: true,
      masteryPassingPercentage: definition.masteryPassingPercentage ?? A1_MASTERY_PASSING_PERCENTAGE,
      status: LessonStatus.PUBLISHED,
      createdById: teacherId,
      teacherId,
      publishedAt: new Date(),
    },
    update: {
      sectionId,
      title: definition.title,
      summary: definition.summary,
      lessonType: LessonType.TEXT,
      position: definition.day,
      durationMinutes: definition.durationMinutes,
      masteryEnabled: true,
      masteryPassingPercentage: definition.masteryPassingPercentage ?? A1_MASTERY_PASSING_PERCENTAGE,
      status: LessonStatus.PUBLISHED,
      teacherId,
      publishedAt: new Date(),
      deletedAt: null,
    },
    select: { id: true },
  });

  // Remove only the earlier non-content placeholder introduced by the first
  // batch. Real optional video blocks must be created through MediaFile upload.
  await tx.lessonContentBlock.updateMany({
    where: { lessonId: lesson.id, title: 'Kelajakdagi video dars uchun joy', deletedAt: null },
    data: { deletedAt: new Date() },
  });

  const activeBlocks = await tx.lessonContentBlock.findMany({
    where: { lessonId: lesson.id, deletedAt: null },
    select: { id: true, position: true, title: true, metadata: true },
  });
  const matchedBlockIds = new Set<string>();
  const normalizeTitle = (value: string): string => value
    .replace(/^\s*\d+[.)\-:]?\s*/u, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLocaleLowerCase('tr-TR');
  const sourceKeyFromMetadata = (metadata: Prisma.JsonValue | null): string | null => {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
    const value = (metadata as Record<string, Prisma.JsonValue>).sourceKey;
    return typeof value === 'string' ? value : null;
  };
  const findExistingBlock = (content: (typeof definition.contentBlocks)[number]) => {
    const unused = activeBlocks.filter((candidate) => !matchedBlockIds.has(candidate.id));
    return unused.find((candidate) => sourceKeyFromMetadata(candidate.metadata) === content.key)
      ?? unused.find((candidate) => sourceKeyFromMetadata(candidate.metadata) === null
        && normalizeTitle(candidate.title ?? '') === normalizeTitle(content.title));
  };

  const desiredBlocks = definition.contentBlocks.map((content) => ({
    content,
    existing: findExistingBlock(content),
  }));
  for (const desired of desiredBlocks) {
    if (desired.existing) matchedBlockIds.add(desired.existing.id);
  }

  // A different sourceKey represents different educational semantics. Archive
  // stale blocks before assigning the new positions so their historical
  // progress remains attached to the old block instead of being reinterpreted.
  const staleBlockIds = activeBlocks
    .filter((block) => !matchedBlockIds.has(block.id))
    .map((block) => block.id);
  if (staleBlockIds.length > 0) {
    await tx.lessonContentBlock.updateMany({
      where: { id: { in: staleBlockIds }, lessonId: lesson.id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  // Move matched blocks out of the active position range before reordering.
  for (const [index, desired] of desiredBlocks.entries()) {
    if (desired.existing) {
      await tx.lessonContentBlock.update({
        where: { id: desired.existing.id },
        data: { position: 1_000_000 + index },
      });
    }
  }

  for (const { content, existing } of desiredBlocks) {
    const data = {
      blockType: content.blockType as LessonContentBlockType,
      title: content.title,
      position: content.position,
      isRequired: content.isRequired ?? content.blockType === 'TEXT',
      isVisible: content.isVisible ?? true,
      ...(content.textContent !== undefined ? { textContent: content.textContent } : {}),
      metadata: {
        sourceKey: content.key,
        isPracticeHolder: Boolean(content.practiceItems),
        ...(content.practiceItems ? { interactivePractice: content.practiceItems } : {}),
      } as unknown as Prisma.InputJsonObject,
      deletedAt: null,
    };
    if (existing) {
      await tx.lessonContentBlock.update({ where: { id: existing.id }, data });
    } else {
      await tx.lessonContentBlock.create({ data: { ...data, lessonId: lesson.id, createdById: teacherId } });
    }
  }

  if (shouldSeedVocabulary) {
    for (const vocabulary of definition.vocabulary) {
      const existing = await tx.lessonVocabulary.findFirst({ where: { lessonId: lesson.id, turkishWord: vocabulary.turkishWord, deletedAt: null }, select: { id: true } });
      if (existing) {
        await tx.lessonVocabulary.update({ where: { id: existing.id }, data: { uzbekMeaning: vocabulary.uzbekMeaning, ...(vocabulary.exampleSentence !== undefined ? { exampleSentence: vocabulary.exampleSentence } : {}), position: vocabulary.position, deletedAt: null } });
      } else {
        await tx.lessonVocabulary.create({ data: { lessonId: lesson.id, ...vocabulary } });
      }
    }

    // Legacy vocabulary reconciliation is explicitly opt-in. A1 V2 content
    // seeding leaves all vocabulary rows and learner mastery data untouched.
    await tx.lessonVocabulary.updateMany({
      where: { lessonId: lesson.id, deletedAt: null, turkishWord: { in: temporaryVocabularyTerms.filter((word) => !definition.vocabulary.some((item) => item.turkishWord === word)) } },
      data: { deletedAt: new Date() },
    });
  }

  const activeQuestions = await tx.lessonQuizQuestion.findMany({
    where: { lessonId: lesson.id, deletedAt: null },
    select: { id: true, prompt: true },
  });
  const matchedQuestionIds = new Set<string>();

  for (const question of definition.questions) {
    const existing = await tx.lessonQuizQuestion.findFirst({ where: { lessonId: lesson.id, prompt: question.prompt, deletedAt: null }, select: { id: true } });
    const questionData = { type: question.type, prompt: question.prompt, explanation: question.explanation, points: question.points, position: question.position, deletedAt: null };
    const questionId = existing
      ? (await tx.lessonQuizQuestion.update({ where: { id: existing.id }, data: questionData, select: { id: true } })).id
      : (await tx.lessonQuizQuestion.create({ data: { lessonId: lesson.id, ...questionData }, select: { id: true } })).id;
    matchedQuestionIds.add(questionId);
    await tx.lessonQuizOption.deleteMany({ where: { questionId } });
    await tx.lessonQuizOption.createMany({ data: question.options.map((option) => ({ questionId, ...option })) });
  }

  const staleQuestionIds = activeQuestions
    .filter((question) => !matchedQuestionIds.has(question.id))
    .map((question) => question.id);
  if (staleQuestionIds.length > 0) {
    await tx.lessonQuizQuestion.updateMany({
      where: { id: { in: staleQuestionIds }, lessonId: lesson.id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }
}

async function main() {
  const teacher = await findContentTeacher();
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const course = await tx.course.upsert({
      where: { slug: a1CourseDefinition.slug },
      create: { ...a1CourseDefinition, level: CourseLevel.A1, status: CourseStatus.PUBLISHED, createdByUserId: teacher.id, teacherId: teacher.id, publishedAt: now },
      update: { title: a1CourseDefinition.title, shortDescription: a1CourseDefinition.shortDescription, description: a1CourseDefinition.description, contentLanguage: a1CourseDefinition.contentLanguage, level: CourseLevel.A1, status: CourseStatus.PUBLISHED, teacherId: teacher.id, publishedAt: now, deletedAt: null },
      select: { id: true },
    });
    const existingSection = await tx.courseSection.findFirst({ where: { courseId: course.id, position: a1SectionDefinition.position, deletedAt: null }, select: { id: true } });
    const section = existingSection
      ? await tx.courseSection.update({ where: { id: existingSection.id }, data: { title: a1SectionDefinition.title, description: a1SectionDefinition.description, isPublished: true, createdById: teacher.id, deletedAt: null }, select: { id: true } })
      : await tx.courseSection.create({ data: { courseId: course.id, ...a1SectionDefinition, isPublished: true, createdById: teacher.id }, select: { id: true } });
    for (const lesson of a1LessonDefinitions) await seedLesson(tx, course.id, section.id, teacher.id, lesson);
  });
  console.info(`Seeded A1 days 1-12 for ${a1CourseDefinition.slug} using ${teacher.email}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'A1 content seed failed.');
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
