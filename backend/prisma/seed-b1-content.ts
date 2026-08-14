import 'dotenv/config';
import { CourseLevel, CourseStatus, LessonStatus, LessonType, PrismaClient, RoleCode, UserStatus, type LessonContentBlockType, type LessonQuizQuestionType, type Prisma } from '@prisma/client';
import { b1CourseDefinition, b1LessonDefinitions, b1SectionDefinition } from './b1-content.js';

const prisma = new PrismaClient();
const sourceKey = (metadata: Prisma.JsonValue | null): string | null => metadata && typeof metadata === 'object' && !Array.isArray(metadata) && typeof (metadata as Record<string, Prisma.JsonValue>).sourceKey === 'string' ? String((metadata as Record<string, Prisma.JsonValue>).sourceKey) : null;
const normalize = (value: string): string => value.replace(/\s+/gu, ' ').trim().toLocaleLowerCase('tr-TR');

async function findTeacher() {
  const email = process.env.B1_CONTENT_TEACHER_EMAIL?.trim();
  const teacher = await prisma.user.findFirst({ where: { status: UserStatus.ACTIVE, deletedAt: null, ...(email ? { email } : {}), roles: { some: { role: { code: RoleCode.TEACHER } } } }, orderBy: { createdAt: 'asc' }, select: { id: true } });
  if (!teacher) throw new Error(email ? `B1 content teacher not found: ${email}` : 'No active Teacher is available for B1 content.');
  return teacher;
}

async function seedLesson(tx: Prisma.TransactionClient, courseId: string, sectionId: string, teacherId: string, definition: (typeof b1LessonDefinitions)[number]) {
  const lesson = await tx.lesson.upsert({ where: { courseId_slug: { courseId, slug: definition.slug } }, create: { courseId, sectionId, title: definition.title, slug: definition.slug, summary: definition.summary, lessonType: LessonType.TEXT, position: definition.day, durationMinutes: definition.durationMinutes, isPreview: false, masteryEnabled: true, masteryPassingPercentage: definition.masteryPassingPercentage, status: LessonStatus.PUBLISHED, createdById: teacherId, teacherId, publishedAt: new Date() }, update: { sectionId, title: definition.title, summary: definition.summary, lessonType: LessonType.TEXT, position: definition.day, durationMinutes: definition.durationMinutes, masteryEnabled: true, masteryPassingPercentage: definition.masteryPassingPercentage, status: LessonStatus.PUBLISHED, teacherId, publishedAt: new Date(), deletedAt: null }, select: { id: true } });
  const activeBlocks = await tx.lessonContentBlock.findMany({ where: { lessonId: lesson.id, deletedAt: null }, select: { id: true, title: true, metadata: true } });
  const matchedBlocks = new Set<string>();
  for (const content of definition.contentBlocks) {
    const candidate = activeBlocks.filter((block) => !matchedBlocks.has(block.id)).find((block) => sourceKey(block.metadata) === content.key) ?? activeBlocks.filter((block) => !matchedBlocks.has(block.id)).find((block) => normalize(block.title ?? '') === normalize(content.title));
    const data = { blockType: content.blockType as LessonContentBlockType, title: content.title, position: content.key === 'theory' ? content.position : content.position + 1, isRequired: true, isVisible: true, textContent: content.textContent ?? '', metadata: { sourceKey: content.key, sourcePosition: content.position, interactivePractice: content.practiceItems } as unknown as Prisma.InputJsonObject, deletedAt: null };
    const block = candidate ? await tx.lessonContentBlock.update({ where: { id: candidate.id }, data, select: { id: true } }) : await tx.lessonContentBlock.create({ data: { lessonId: lesson.id, createdById: teacherId, ...data }, select: { id: true } });
    matchedBlocks.add(block.id);
  }
  const staleBlocks = activeBlocks.filter((block) => !matchedBlocks.has(block.id)).map((block) => block.id);
  if (staleBlocks.length) await tx.lessonContentBlock.updateMany({ where: { id: { in: staleBlocks }, lessonId: lesson.id, deletedAt: null }, data: { deletedAt: new Date() } });
  const activeQuestions = await tx.lessonQuizQuestion.findMany({ where: { lessonId: lesson.id, deletedAt: null }, select: { id: true, type: true, prompt: true, options: { orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { text: true } } } });
  const matchedQuestions = new Set<string>();
  const signature = (question: { type: string; prompt: string; options: Array<{ text: string }> }): string => JSON.stringify({ type: question.type, prompt: question.prompt, options: question.options.map((option) => option.text) });
  for (const question of definition.questions) {
    const existing = activeQuestions.find((candidate) => !matchedQuestions.has(candidate.id) && signature(candidate) === signature(question));
    const data = { type: question.type as LessonQuizQuestionType, prompt: question.prompt, explanation: question.explanation, points: question.points, position: question.position, deletedAt: null };
    const id = existing ? (await tx.lessonQuizQuestion.update({ where: { id: existing.id }, data, select: { id: true } })).id : (await tx.lessonQuizQuestion.create({ data: { lessonId: lesson.id, ...data }, select: { id: true } })).id;
    matchedQuestions.add(id);
    await tx.lessonQuizOption.deleteMany({ where: { questionId: id } });
    if (question.options.length) await tx.lessonQuizOption.createMany({ data: question.options.map((option) => ({ questionId: id, text: option.text, isCorrect: option.isCorrect, position: option.position })) });
  }
  const staleQuestions = activeQuestions.filter((question) => !matchedQuestions.has(question.id)).map((question) => question.id);
  if (staleQuestions.length) await tx.lessonQuizQuestion.updateMany({ where: { id: { in: staleQuestions }, lessonId: lesson.id, deletedAt: null }, data: { deletedAt: new Date() } });
}

async function main() {
  const teacher = await findTeacher();
  await prisma.$transaction(async (tx) => {
    const course = await tx.course.upsert({ where: { slug: b1CourseDefinition.slug }, create: { ...b1CourseDefinition, level: CourseLevel.B1, status: CourseStatus.PUBLISHED, createdByUserId: teacher.id, teacherId: teacher.id, publishedAt: new Date() }, update: { ...b1CourseDefinition, level: CourseLevel.B1, status: CourseStatus.PUBLISHED, teacherId: teacher.id, publishedAt: new Date(), deletedAt: null }, select: { id: true } });
    const existing = await tx.courseSection.findFirst({ where: { courseId: course.id, position: b1SectionDefinition.position, deletedAt: null }, select: { id: true } });
    const section = existing ? await tx.courseSection.update({ where: { id: existing.id }, data: { title: b1SectionDefinition.title, description: b1SectionDefinition.description, isPublished: true, deletedAt: null }, select: { id: true } }) : await tx.courseSection.create({ data: { courseId: course.id, ...b1SectionDefinition, isPublished: true, createdById: teacher.id }, select: { id: true } });
    for (const definition of b1LessonDefinitions) await seedLesson(tx, course.id, section.id, teacher.id, definition);
  });
  console.info(`Seeded B1 lessons ${b1LessonDefinitions.length}; practice ${b1LessonDefinitions.reduce((sum, lesson) => sum + lesson.contentBlocks.reduce((n, block) => n + block.practiceItems.length, 0), 0)}; tests ${b1LessonDefinitions.reduce((sum, lesson) => sum + lesson.questions.length, 0)}.`);
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'B1 content seed failed.'); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
