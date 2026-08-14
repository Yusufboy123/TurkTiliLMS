import 'dotenv/config';
import { CourseLevel, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const levels = [
  { level: CourseLevel.A1, title: 'A1 yakuniy imtihoni', perLesson: 5 },
  { level: CourseLevel.A2, title: 'A2 yakuniy imtihoni', perLesson: 5 },
  { level: CourseLevel.B1, title: 'B1 yakuniy imtihoni', perLesson: 5 },
  { level: CourseLevel.B2, title: 'B2 yakuniy imtihoni', perLesson: 5 },
] as const;

async function seedLevel(level: (typeof levels)[number]) {
  const courses = await prisma.course.findMany({
    where: { level: level.level, deletedAt: null },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, _count: { select: { lessons: true } } },
  });
  const course = courses.sort((a, b) => b._count.lessons - a._count.lessons)[0];
  if (!course) throw new Error(`${level.level} course not found.`);

  const lessons = await prisma.lesson.findMany({
    where: { courseId: course.id, deletedAt: null, status: 'PUBLISHED' },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
  const questionsByLesson = await Promise.all(lessons.map(async (lesson) => {
    const questions = await prisma.lessonQuizQuestion.findMany({
      where: { lessonId: lesson.id, deletedAt: null },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    return questions;
  }));
  const desired = questionsByLesson.flatMap((questions) => level.level === CourseLevel.B1 ? [1, 17, 21, 27, 29].map((position) => questions[position - 1]).filter((question): question is { id: string } => Boolean(question)) : questions.slice(0, level.perLesson));
  const targetCount = level.level === CourseLevel.A1 ? 60 : level.level === CourseLevel.A2 ? 70 : 80;
  if (desired.length < targetCount) {
    for (let offset = level.perLesson; desired.length < targetCount; offset += 1) {
      for (const questions of questionsByLesson) {
        const question = questions[offset];
        if (question && !desired.some((candidate) => candidate.id === question.id)) desired.push(question);
        if (desired.length === targetCount) break;
      }
      if (offset > Math.max(...questionsByLesson.map((questions) => questions.length))) break;
    }
  }
  if (desired.length !== targetCount) {
    throw new Error(`${level.level} final exam source questions are incomplete: ${desired.length}/${targetCount}.`);
  }

  await prisma.$transaction(async (tx) => {
    const exam = await tx.levelFinalExam.upsert({
      where: { level: level.level },
      create: { level: level.level, title: level.title, passingPercentage: 75, questionCount: desired.length },
      update: { title: level.title, passingPercentage: 75, questionCount: desired.length },
      select: { id: true },
    });
    const desiredIds = new Set(desired.map((question) => question.id));
    await tx.levelFinalExamQuestion.updateMany({
      where: { examId: exam.id, deletedAt: null, sourceQuestionId: { notIn: [...desiredIds] } },
      data: { deletedAt: new Date() },
    });
    const existingDesired = await tx.levelFinalExamQuestion.findMany({ where: { examId: exam.id, sourceQuestionId: { in: [...desiredIds] } }, select: { id: true } });
    for (const [index, link] of existingDesired.entries()) {
      await tx.levelFinalExamQuestion.update({ where: { id: link.id }, data: { position: -(index + 1) } });
    }
    for (const [index, sourceQuestion] of desired.entries()) {
      const existing = await tx.levelFinalExamQuestion.findFirst({ where: { examId: exam.id, sourceQuestionId: sourceQuestion.id } });
      if (existing) {
        await tx.levelFinalExamQuestion.update({ where: { id: existing.id }, data: { position: index + 1, deletedAt: null } });
      } else {
        await tx.levelFinalExamQuestion.create({ data: { examId: exam.id, sourceQuestionId: sourceQuestion.id, position: index + 1 } });
      }
    }
  });
  return { level: level.level, lessons: lessons.length, questions: desired.length };
}

async function main() {
  const results = [];
  for (const level of levels) results.push(await seedLevel(level));
  console.log(JSON.stringify(results));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Level final exam seed failed.');
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
