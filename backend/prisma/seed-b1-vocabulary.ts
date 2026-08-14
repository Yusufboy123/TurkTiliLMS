import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { CourseStatus, PrismaClient, VocabularySourceStatus } from '@prisma/client';

type SourceWord = { id: string; tr: string; uz: string; lesson: number; status: 'NEW' | 'REVIEW'; example?: string };
const prisma = new PrismaClient();
const sourcePath = process.env.B1_VOCABULARY_SOURCE ?? 'D:\\Turk tili\\Darsliklar\\B1\\04_LUGATLAR\\B1_Lugatlar.html';

async function main() {
  const html = await fs.readFile(path.resolve(sourcePath), 'utf8');
  const match = html.match(/const words=(\[[\s\S]*?\])\s*,S=/u);
  if (!match?.[1]) throw new Error('B1 vocabulary source does not contain words.');
  const words = JSON.parse(match[1]) as SourceWord[];
  if (words.length !== 632 || new Set(words.map((word) => word.id)).size !== words.length || words.filter((word) => word.status === 'NEW').length !== 512 || words.filter((word) => word.status === 'REVIEW').length !== 120) throw new Error('B1 vocabulary source coverage is invalid.');
  const course = await prisma.course.findFirst({ where: { slug: 'turk-tili-b1', status: CourseStatus.PUBLISHED, deletedAt: null }, select: { id: true, lessons: { where: { deletedAt: null }, orderBy: { position: 'asc' }, select: { id: true, position: true } } } });
  if (!course || course.lessons.length !== 16) throw new Error('B1 course lessons are not ready.');
  const byLesson = new Map(course.lessons.map((lesson) => [lesson.position, lesson.id]));
  await prisma.$transaction(async (tx) => {
    const positions = new Map<number, number>();
    for (const word of words) {
      const lessonId = byLesson.get(word.lesson);
      if (!lessonId) throw new Error(`B1 vocabulary lesson ${word.lesson} has no lesson.`);
      const position = (positions.get(word.lesson) ?? 0) + 1;
      positions.set(word.lesson, position);
      await tx.lessonVocabulary.upsert({ where: { lessonId_sourceId: { lessonId, sourceId: word.id } }, create: { lessonId, sourceId: word.id, sourceStatus: word.status === 'NEW' ? VocabularySourceStatus.NEW : VocabularySourceStatus.REVIEW, turkishWord: word.tr, uzbekMeaning: word.uz, exampleSentence: word.example ?? null, position }, update: { sourceStatus: word.status === 'NEW' ? VocabularySourceStatus.NEW : VocabularySourceStatus.REVIEW, turkishWord: word.tr, uzbekMeaning: word.uz, exampleSentence: word.example ?? null, position, deletedAt: null } });
    }
    await tx.lessonVocabulary.updateMany({ where: { lessonId: { in: course.lessons.map((lesson) => lesson.id) }, deletedAt: null, sourceId: { notIn: words.map((word) => word.id) } }, data: { deletedAt: new Date() } });
  });
  console.info(`Seeded B1 vocabulary: ${words.length} (${words.filter((word) => word.status === 'NEW').length} NEW, ${words.filter((word) => word.status === 'REVIEW').length} REVIEW).`);
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'B1 vocabulary seed failed.'); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
