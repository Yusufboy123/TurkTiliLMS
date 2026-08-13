import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { CourseStatus, PrismaClient, RoleCode, UserStatus, VocabularySourceStatus } from '@prisma/client';

type SourceWord = { id: string; tr: string; uz: string; newDay: number; reviewDays?: number[]; questionable?: boolean; course: 'A1' | 'A2' };

const prisma = new PrismaClient();
const sourcePaths = {
  A1: process.env.A1_VOCABULARY_SOURCE ?? 'D:\\Turk tili\\Darsliklar\\A1\\04_LUGATLAR\\A1_Lugatlar.html',
  A2: process.env.A2_VOCABULARY_SOURCE ?? 'D:\\Turk tili\\Darsliklar\\A2\\04_LUGATLAR\\A2_Lugatlar.html',
} as const;

async function readWords(course: 'A1' | 'A2'): Promise<SourceWord[]> {
  const html = await fs.readFile(path.resolve(sourcePaths[course]), 'utf8');
  const match = html.match(/const allWords=(\[.*?\]);/s);
  if (!match?.[1]) throw new Error(`${course} vocabulary source does not contain allWords.`);
  const words = JSON.parse(match[1]) as SourceWord[];
  if (words.length !== (course === 'A1' ? 742 : 712) || new Set(words.map((word) => word.id)).size !== words.length) {
    throw new Error(`${course} vocabulary source coverage is invalid.`);
  }
  return words;
}

async function contentTeacher() {
  const teacher = await prisma.user.findFirst({
    where: { status: UserStatus.ACTIVE, deletedAt: null, roles: { some: { role: { code: RoleCode.TEACHER } } } },
    orderBy: { createdAt: 'asc' }, select: { id: true },
  });
  if (!teacher) throw new Error('No active Teacher is available for vocabulary import.');
  return teacher.id;
}

async function seedCourse(courseSlug: string, course: 'A1' | 'A2', words: SourceWord[]) {
  const record = await prisma.course.findFirst({ where: { slug: courseSlug, status: CourseStatus.PUBLISHED, deletedAt: null }, select: { id: true, lessons: { where: { deletedAt: null }, orderBy: { position: 'asc' }, select: { id: true, position: true } } } });
  if (!record || record.lessons.length !== (course === 'A1' ? 12 : 14)) throw new Error(`${course} course lessons are not ready.`);
  const byDay = new Map(record.lessons.map((lesson) => [lesson.position, lesson.id]));
  await prisma.$transaction(async (tx) => {
    const positions = new Map<number, number>();
    for (const word of words) {
      const days = [word.newDay, ...(word.reviewDays ?? [])];
      for (const day of days) {
        const lessonId = byDay.get(day);
        if (!lessonId) throw new Error(`${course} vocabulary day ${day} has no lesson.`);
        const position = (positions.get(day) ?? 0) + 1;
        positions.set(day, position);
        const sourceStatus = day === word.newDay
          ? (word.questionable ? VocabularySourceStatus.QUESTIONABLE : VocabularySourceStatus.NEW)
          : VocabularySourceStatus.REVIEW;
        await tx.lessonVocabulary.upsert({
          where: { lessonId_sourceId: { lessonId, sourceId: word.id } },
          create: { lessonId, sourceId: word.id, sourceStatus, turkishWord: word.tr, uzbekMeaning: word.uz, position },
          update: { sourceStatus, turkishWord: word.tr, uzbekMeaning: word.uz, position, deletedAt: null },
        });
      }
    }
  });
  return { sourceEntries: words.length, rows: words.reduce((sum, word) => sum + 1 + (word.reviewDays?.length ?? 0), 0) };
}

async function main() {
  await contentTeacher();
  const [a1, a2] = await Promise.all([readWords('A1'), readWords('A2')]);
  const [a1Result, a2Result] = await Promise.all([seedCourse('turk-tili-a1', 'A1', a1), seedCourse('turk-tili-a2', 'A2', a2)]);
  console.info(JSON.stringify({ a1: a1Result, a2: a2Result, total: a1Result.sourceEntries + a2Result.sourceEntries }));
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Vocabulary import failed.'); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
