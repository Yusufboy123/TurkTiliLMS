import { Link, useParams } from 'react-router-dom';
import { Badge, Card } from '../../../components';
import {
  useTeacherLesson,
  useTeacherLessonBlocks,
  useTeacherLessonQuizQuestions,
  useTeacherLessonVocabulary,
} from '../hooks/use-teacher-lessons';
import { teacherLessonPaths } from '../teacher-lessons.routes';
import { PracticeModeView } from '../../student-player/components/PracticeModeView';
import type { StudentLessonBlock } from '../../student-player/types/student-player.types';

function mediaUrl(block: { media?: { previewUrl: string | null } | null; fileUrl: string | null; sourceUrl: string | null }) {
  return block.media?.previewUrl ?? block.fileUrl ?? block.sourceUrl ?? undefined;
}

export default function TeacherLessonPreviewPage() {
  const { courseId = '', lessonId = '' } = useParams<{ courseId: string; lessonId: string }>();
  const lesson = useTeacherLesson(courseId, lessonId);
  const blocks = useTeacherLessonBlocks(courseId, lessonId);
  const vocabulary = useTeacherLessonVocabulary(courseId, lessonId);
  const questions = useTeacherLessonQuizQuestions(courseId, lessonId);

  if (lesson.isPending) return <p role="status">Yuklanmoqda…</p>;
  if (lesson.isError || !lesson.data) return <p className="text-danger-text" role="alert">Dars topilmadi.</p>;

  return (
    <main className="mx-auto grid max-w-dashboard gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link className="text-body-sm text-action-primary-text" to={teacherLessonPaths.detail(courseId, lessonId)}>
            ← Darsni tahrirlashga qaytish
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Badge intent="info">Preview rejimi</Badge>
            <span className="text-body-sm text-text-secondary">{lesson.data.course.title}</span>
          </div>
          <h1 className="type-heading-1 mt-3 break-words">{lesson.data.title}</h1>
          {lesson.data.summary ? <p className="mt-2 max-w-3xl text-body-md text-text-secondary">{lesson.data.summary}</p> : null}
        </div>
        <Link className="inline-flex min-h-target items-center justify-center rounded-md border border-border-decorative px-4 py-2 text-button text-text-primary transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" to={teacherLessonPaths.detail(courseId, lessonId)}>Tahrirlashga qaytish</Link>
      </header>

      <section aria-labelledby="preview-content-title">
        <Card>
          <h2 className="type-heading-3" id="preview-content-title">Dars kontenti</h2>
          {lesson.data.content ? <p className="mt-4 whitespace-pre-wrap text-body-md">{lesson.data.content}</p> : null}
          {blocks.isPending ? <p className="mt-4" role="status">Kontent yuklanmoqda…</p> : null}
          {blocks.isError ? <p className="mt-4 text-danger-text" role="alert">Kontentni yuklab bo‘lmadi.</p> : null}
          {blocks.data?.items.length === 0 && !lesson.data.content ? <p className="mt-4 text-body-md text-text-secondary">Hozircha kontent mavjud emas.</p> : null}
          <div className="mt-5 grid gap-5">
            {blocks.data?.items.filter((block) => block.isVisible && !(block as { isPracticeHolder?: boolean }).isPracticeHolder).map((block) => {
              const url = mediaUrl(block);
              return (
                <article className="rounded-lg border border-border-decorative p-4" key={block.id}>
                  <h3 className="type-heading-4 break-words">{block.title ?? 'Kontent bloki'}</h3>
                  {block.blockType === 'TEXT' ? <p className="mt-3 whitespace-pre-wrap text-body-md">{block.textContent ?? ''}</p> : null}
                  {block.blockType === 'IMAGE' && url ? <img alt={block.title ?? 'Dars rasmi'} className="mt-3 max-h-96 w-full rounded-md object-contain" src={url} /> : null}
                  {block.blockType === 'VIDEO' && url ? <video aria-label={block.title ?? 'Video dars materiali'} className="mt-3 aspect-video w-full rounded-md bg-black" controls src={url} /> : null}
                  {block.blockType === 'AUDIO' && url ? <audio aria-label={block.title ?? 'Audio dars materiali'} className="mt-3 w-full" controls src={url} /> : null}
                  {!url && block.blockType !== 'TEXT' ? <p className="mt-3 text-body-sm text-text-secondary">Media biriktirilmagan.</p> : null}
                </article>
              );
            })}
          </div>
        </Card>
      </section>

      <section aria-labelledby="preview-practice-title">
        <Card>
          <h2 className="type-heading-3" id="preview-practice-title">Mashqlar (Preview)</h2>
          <p className="mt-2 mb-4 text-body-sm text-text-secondary">Bu faqat ko‘rish rejimi. Javoblar saqlanmaydi.</p>
          {blocks.data && (
            <PracticeModeView
              blocks={blocks.data.items as unknown as StudentLessonBlock[]}
              enrollmentId="preview"
              lessonId={lessonId}
              onReturnToLearn={() => {}}
              onStartTest={() => {}}
            />
          )}
        </Card>
      </section>

      <section aria-labelledby="preview-vocabulary-title">
        <Card>
          <h2 className="type-heading-3" id="preview-vocabulary-title">Yangi so‘zlar</h2>
          {vocabulary.isPending ? <p className="mt-4" role="status">So‘zlar yuklanmoqda…</p> : null}
          {vocabulary.data?.length === 0 ? <p className="mt-4 text-body-md text-text-secondary">Hozircha yangi so‘zlar yo‘q.</p> : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {vocabulary.data?.map((word) => <div className="rounded-lg border border-border-decorative p-4" key={word.id}><p className="font-semibold">{word.turkishWord}</p><p className="mt-1 text-body-sm text-text-secondary">{word.uzbekMeaning}</p>{word.exampleSentence ? <p className="mt-2 text-body-sm italic text-text-muted">{word.exampleSentence}</p> : null}</div>)}
          </div>
        </Card>
      </section>

      <section aria-labelledby="preview-quiz-title">
        <Card>
          <h2 className="type-heading-3" id="preview-quiz-title">Yakuniy test</h2>
          <p className="mt-2 text-body-sm text-text-secondary">Bu faqat ko‘rish rejimi. Javoblar saqlanmaydi.</p>
          {questions.isPending ? <p className="mt-4" role="status">Test yuklanmoqda…</p> : null}
          {questions.data?.length === 0 ? <p className="mt-4 text-body-md text-text-secondary">Hozircha test savollari yo‘q.</p> : null}
          <div className="mt-4 grid gap-4">
            {questions.data?.map((question, index) => <fieldset className="rounded-lg border border-border-decorative p-4" key={question.id}><legend className="px-1 font-semibold">{index + 1}. {question.prompt}</legend><div className="mt-3 grid gap-2">{question.options.map((option) => <label className="flex items-start gap-2 text-body-sm" key={option.id}><input disabled name={`preview-question-${question.id}`} type="radio" /><span>{option.text}</span></label>)}</div>{question.type === 'MISSING_WORD' ? <input aria-label="Javob" className="mt-3 w-full rounded-md border border-border-decorative px-3 py-2" disabled placeholder="Javob maydoni" /> : null}</fieldset>)}
          </div>
        </Card>
      </section>
    </main>
  );
}
