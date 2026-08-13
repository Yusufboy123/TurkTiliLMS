import 'dotenv/config';
import { CourseLevel, CourseStatus, LessonStatus, LessonType, PrismaClient, UserStatus, RoleCode, type LessonContentBlockType, type Prisma } from '@prisma/client';
import { a2CourseDefinition, a2LessonDefinitions, a2SectionDefinition, A2_MASTERY_PASSING_PERCENTAGE } from './a2-content.js';

const prisma = new PrismaClient();

async function findTeacher() {
  const email = process.env.A2_CONTENT_TEACHER_EMAIL?.trim();
  const teacher = await prisma.user.findFirst({
    where: { status: UserStatus.ACTIVE, deletedAt: null, ...(email ? { email } : {}), roles: { some: { role: { code: RoleCode.TEACHER } } } },
    orderBy: { createdAt: 'asc' }, select: { id: true, email: true },
  });
  if (!teacher) throw new Error(email ? `A2 content teacher not found: ${email}` : 'No active Teacher is available for A2 content.');
  return teacher;
}

async function seedLesson(tx: Prisma.TransactionClient, courseId: string, sectionId: string, teacherId: string, definition: (typeof a2LessonDefinitions)[number]) {
  const lesson = await tx.lesson.upsert({
    where: { courseId_slug: { courseId, slug: definition.slug } },
    create: { courseId, sectionId, title: definition.title, slug: definition.slug, summary: definition.summary, lessonType: LessonType.TEXT, position: definition.day, durationMinutes: definition.durationMinutes, isPreview: false, masteryEnabled: true, masteryPassingPercentage: definition.masteryPassingPercentage, status: LessonStatus.PUBLISHED, createdById: teacherId, teacherId, publishedAt: new Date() },
    update: { sectionId, title: definition.title, summary: definition.summary, lessonType: LessonType.TEXT, position: definition.day, durationMinutes: definition.durationMinutes, masteryEnabled: true, masteryPassingPercentage: definition.masteryPassingPercentage, status: LessonStatus.PUBLISHED, teacherId, publishedAt: new Date(), deletedAt: null },
    select: { id: true },
  });

  const activeBlocks = await tx.lessonContentBlock.findMany({
    where: { lessonId: lesson.id, deletedAt: null },
    select: { id: true, position: true, title: true, metadata: true },
  });
  const matchedBlockIds = new Set<string>();
  const sourceKeyFromMetadata = (metadata: Prisma.JsonValue | null): string | null => {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
    const value = (metadata as Record<string, Prisma.JsonValue>).sourceKey;
    return typeof value === 'string' ? value : null;
  };
  const normalizeTitle = (value: string): string => value.replace(/\s+/gu, ' ').trim().toLocaleLowerCase('tr-TR');
  const findExistingBlock = (content: (typeof definition.contentBlocks)[number]) => {
    const unused = activeBlocks.filter((candidate) => !matchedBlockIds.has(candidate.id));
    return unused.find((candidate) => sourceKeyFromMetadata(candidate.metadata) === content.key)
      ?? unused.find((candidate) => normalizeTitle(candidate.title ?? '') === normalizeTitle(content.title))
      ?? unused.find((candidate) => candidate.position === content.position);
  };

  for (const content of definition.contentBlocks) {
    const data = {
      blockType: content.blockType as LessonContentBlockType,
      title: content.title,
      position: content.position,
      isRequired: true,
      isVisible: true,
      textContent: content.textContent ?? null,
      metadata: {
        sourceKey: content.key,
        ...(content.practiceItems ? { interactivePractice: content.practiceItems } : {}),
      } as unknown as Prisma.InputJsonObject,
      deletedAt: null,
    };
    const existing = findExistingBlock(content);
    if (existing) {
      matchedBlockIds.add(existing.id);
      await tx.lessonContentBlock.update({ where: { id: existing.id }, data });
    } else {
      const created = await tx.lessonContentBlock.create({ data: { ...data, lessonId: lesson.id, createdById: teacherId }, select: { id: true } });
      matchedBlockIds.add(created.id);
    }
  }

  const staleBlockIds = activeBlocks.filter((block) => !matchedBlockIds.has(block.id)).map((block) => block.id);
  if (staleBlockIds.length > 0) {
    await tx.lessonContentBlock.updateMany({ where: { id: { in: staleBlockIds }, lessonId: lesson.id, deletedAt: null }, data: { deletedAt: new Date() } });
  }

  const activeQuestions = await tx.lessonQuizQuestion.findMany({
    where: { lessonId: lesson.id, deletedAt: null },
    select: { id: true, type: true, prompt: true, options: { orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { text: true, position: true } } },
  });
  const matchedQuestionIds = new Set<string>();
  // The option-bearing question signature is stable when source order changes,
  // while remaining schema-free for the existing quiz tables.
  const questionSignature = (question: { type: string; prompt: string; options: Array<{ text: string; position: number }> }): string =>
    JSON.stringify({ type: question.type, prompt: question.prompt, options: question.options.map((option) => option.text) });
  const findExistingQuestion = (question: (typeof definition.questions)[number]) => {
    const signature = questionSignature(question);
    return activeQuestions.find((candidate) => !matchedQuestionIds.has(candidate.id) && questionSignature(candidate) === signature);
  };

  for (const question of definition.questions) {
    const existing = findExistingQuestion(question);
    const questionData = { type: question.type, prompt: question.prompt, explanation: question.explanation, points: question.points, position: question.position, deletedAt: null };
    const questionId = existing
      ? (await tx.lessonQuizQuestion.update({ where: { id: existing.id }, data: questionData, select: { id: true } })).id
      : (await tx.lessonQuizQuestion.create({ data: { lessonId: lesson.id, ...questionData }, select: { id: true } })).id;
    matchedQuestionIds.add(questionId);
    await tx.lessonQuizOption.deleteMany({ where: { questionId } });
    await tx.lessonQuizOption.createMany({ data: question.options.map((option) => ({ questionId, text: option.text, isCorrect: option.isCorrect, position: option.position })) });
  }

  const staleQuestionIds = activeQuestions.filter((question) => !matchedQuestionIds.has(question.id)).map((question) => question.id);
  if (staleQuestionIds.length > 0) {
    await tx.lessonQuizQuestion.updateMany({ where: { id: { in: staleQuestionIds }, lessonId: lesson.id, deletedAt: null }, data: { deletedAt: new Date() } });
  }
}

async function main() {
  const teacher = await findTeacher();
  await prisma.$transaction(async (tx) => {
    const course = await tx.course.upsert({ where: { slug: a2CourseDefinition.slug }, create: { ...a2CourseDefinition, level: CourseLevel.A2, status: CourseStatus.PUBLISHED, createdByUserId: teacher.id, teacherId: teacher.id, publishedAt: new Date() }, update: { ...a2CourseDefinition, level: CourseLevel.A2, status: CourseStatus.PUBLISHED, teacherId: teacher.id, publishedAt: new Date(), deletedAt: null }, select: { id: true } });
    const current = await tx.courseSection.findFirst({ where: { courseId: course.id, position: a2SectionDefinition.position, deletedAt: null }, select: { id: true } });
    const section = current ? await tx.courseSection.update({ where: { id: current.id }, data: { title: a2SectionDefinition.title, description: a2SectionDefinition.description, isPublished: true, deletedAt: null }, select: { id: true } }) : await tx.courseSection.create({ data: { courseId: course.id, ...a2SectionDefinition, isPublished: true, createdById: teacher.id }, select: { id: true } });
    for (const definition of a2LessonDefinitions) await seedLesson(tx, course.id, section.id, teacher.id, definition);
  });
  console.info(`Seeded A2 lessons 1-14 for ${teacher.email}; mastery ${A2_MASTERY_PASSING_PERCENTAGE}%.`);
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'A2 content seed failed.'); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
