import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, SkipLink } from '../../../components';
import { useOnlineStatus } from '../../../hooks/use-online-status';
import { progressMessages } from '../../../locales/uz-Latn/progress';
import {
  BlockStatusIndicator,
  LessonStatusBadge,
  ProgressBar,
  ProgressEmptyState,
  ProgressError,
  ProgressPageHeader,
  ProgressRefreshStatus,
  ProgressSkeleton,
} from '../components';
import { createIdempotencyKey } from '../api/progress.api';
import { useProgressMutations } from '../hooks/use-progress-mutations';
import { useEnrollmentProgress } from '../hooks/use-progress-queries';
import { createLessonVisitStateMachine } from '../lesson-visit-state-machine';
import { progressPaths } from '../progress.routes';
import { unavailableReasonLabel } from '../utils/progress-format';
import { StudentQuizPanel, StudentVocabularyPanel, useStudentLessonContent } from '../../student-player';
import type { StudentLessonBlock } from '../../student-player';
import { useLessonBookmark, useLessonNote } from '../../student-productivity';

function blockMediaUrl(block: StudentLessonBlock, mediaUrls: Record<string, string>): string | null {
  return (block.mediaFileId ? mediaUrls[block.mediaFileId] : undefined) ?? block.sourceUrl ?? block.fileUrl;
}

function LessonContentBlockView({ block, mediaUrls }: { block: StudentLessonBlock; mediaUrls: Record<string, string> }) {
  const mediaUrl = blockMediaUrl(block, mediaUrls);
  return (
    <div className="mt-4">
      {block.blockType === 'TEXT' ? (
        <p className="whitespace-pre-wrap text-body-lg leading-8 text-text-primary">{block.textContent}</p>
      ) : null}
      {block.blockType === 'VIDEO' && mediaUrl ? (
        <video aria-label={block.title ?? 'Video dars materiali'} className="mt-2 aspect-video w-full rounded-lg bg-black" controls preload="metadata" src={mediaUrl} />
      ) : null}
      {block.blockType === 'AUDIO' && mediaUrl ? (
        <div className="mt-2 rounded-lg bg-subtle p-4"><audio aria-label={block.title ?? 'Audio dars materiali'} className="w-full" controls preload="metadata" src={mediaUrl} /></div>
      ) : null}
      {block.blockType === 'IMAGE' && mediaUrl ? (
        <img alt={block.title ?? 'Dars rasmi'} className="mt-2 max-h-[32rem] w-full rounded-lg object-contain" src={mediaUrl} />
      ) : null}
      {!mediaUrl && block.blockType !== 'TEXT' ? <p className="text-body-sm text-text-secondary">Media materiali hozircha mavjud emas.</p> : null}
    </div>
  );
}

export default function LessonProgressPage() {
  const { enrollmentId = '', lessonId = '' } = useParams();
  const progress = useEnrollmentProgress(enrollmentId);
  const {
    completeBlock,
    completeLesson,
    completionMutation,
    reopenBlock,
    reopenLesson,
    visitMutation,
  } = useProgressMutations();
  const isOnline = useOnlineStatus();
  const visitStateMachineRef = useRef(createLessonVisitStateMachine(createIdempotencyKey));

  const lessons = useMemo(
    () => progress.data?.sections.flatMap((section) => section.lessons) ?? [],
    [progress.data],
  );
  const lesson = lessons.find((item) => item.id === lessonId);
  const lessonIndex = lessons.findIndex((item) => item.id === lessonId);
  const previousLesson = lessonIndex > 0 ? lessons[lessonIndex - 1] : null;
  const nextLesson = lessonIndex >= 0 ? lessons[lessonIndex + 1] : null;
  const content = useStudentLessonContent(
    progress.data?.course.slug ?? '',
    lesson?.slug ?? '',
    Boolean(progress.data?.capabilities.canAccessCourseContent && lesson),
  );
  const lessonBookmark = useLessonBookmark(lessonId);
  const lessonNote = useLessonNote(lessonId, Boolean(progress.data?.capabilities.canAccessCourseContent));
  const [noteText, setNoteText] = useState('');
  const recordVisit = visitMutation.mutateAsync;

  useEffect(() => {
    if (!progress.data || !lesson) {
      return;
    }

    const visitStateMachine = visitStateMachineRef.current;
    visitStateMachine.selectLesson({
      enrollmentId,
      lessonId: lesson.id,
      curriculumVersion: progress.data.curriculumVersion,
    });

    void visitStateMachine
      .attempt(
        {
          canRecordActivity: progress.data.capabilities.canRecordActivity,
          isOnline,
        },
        recordVisit,
      )
      .catch(() => undefined);
  }, [enrollmentId, isOnline, lesson, progress.data, recordVisit]);

  useEffect(() => {
    if (lessonNote.query.data) setNoteText(lessonNote.query.data.content);
  }, [lessonNote.query.data]);

  if (progress.isPending) {
    return (
      <div className="mx-auto max-w-content px-4 py-8">
        <ProgressSkeleton cards={4} />
      </div>
    );
  }
  if (progress.isError && !progress.data) {
    return (
      <div className="mx-auto max-w-content px-4 py-8">
        <ProgressError error={progress.error} onRetry={() => void progress.refetch()} />
      </div>
    );
  }
  if (!lesson) {
    return (
      <div className="mx-auto max-w-content px-4 py-8">
        <ProgressEmptyState
          body={progressMessages.lesson.notFoundBody}
          title={progressMessages.lesson.notFoundTitle}
        />
      </div>
    );
  }

  const completionInput = {
    enrollmentId,
    curriculumVersion: progress.data.curriculumVersion,
    expectedCompletionVersion: progress.data.completionVersion,
  };
  const mutationPending = completionMutation.isPending;
  const pendingResourceId = completionMutation.variables?.resourceId;
  const unavailable =
    unavailableReasonLabel(lesson.capabilities.unavailableReason) ??
    unavailableReasonLabel(progress.data.capabilities.unavailableReason);
  const lessonCompleted =
    lesson.status === 'COMPLETED' ||
    (completionMutation.data?.affectedLesson.id === lesson.id &&
      completionMutation.data.affectedLesson.status === 'COMPLETED');

  return (
    <div className="min-h-screen bg-canvas pb-32 text-text-primary md:pb-8">
      <SkipLink targetId="lesson-main-content" />
      <header className="sticky top-0 z-sticky border-b border-border-decorative/80 bg-surface/95 shadow-subtle backdrop-blur">
        <div className="mx-auto flex h-16 max-w-content items-center gap-4 px-4 md:px-6">
          <Link
            className="inline-flex min-h-target items-center text-button"
            to={progressPaths.course(enrollmentId)}
          >
            {progressMessages.common.back}
          </Link>
          <p className="min-w-0 truncate text-label-md text-text-secondary">
            {progress.data.course.title}
          </p>
        </div>
      </header>

      {!isOnline ? (
        <div
          className="border-b border-warning-border bg-warning-bg px-4 py-3 text-center text-body-sm text-warning-text"
          role="status"
        >
          {progressMessages.common.offlineLesson}
        </div>
      ) : null}

      <main
        className="mx-auto max-w-content px-4 py-8 md:px-6"
        id="lesson-main-content"
        tabIndex={-1}
      >
        <div className="max-w-reading">
          <div className="flex flex-wrap items-start justify-between gap-3"><ProgressPageHeader title={lesson.title} /><Button disabled={!progress.data.capabilities.canAccessCourseContent || lessonBookmark.isPending} intent="secondary" onClick={lessonBookmark.toggle}>{lessonBookmark.isBookmarked ? 'Saqlangan' : 'Saqlash'}</Button></div>
        </div>
        <ProgressRefreshStatus
          error={progress.error}
          isError={progress.isError}
          isFetching={progress.isFetching}
        />
        <div className="flex flex-wrap items-center gap-3">
          <LessonStatusBadge status={lesson.status} />
          <span className="text-caption text-text-muted">
            {lesson.completedEligibleBlocks}/{lesson.totalEligibleBlocks}{' '}
            {progressMessages.progress.blocks}
          </span>
        </div>
        <div className="mt-5 max-w-reading">
          <ProgressBar label={progressMessages.progress.lessonProgress} value={lesson.percentage} />
        </div>

        {content.lesson.data?.summary || content.lesson.data?.content ? (
          <Card className="mt-8 max-w-reading" elevation="none" padding="lg">
            {content.lesson.data.summary ? <p className="text-body-lg leading-8">{content.lesson.data.summary}</p> : null}
            {content.lesson.data.content ? <p className="mt-4 whitespace-pre-wrap text-body-lg leading-8">{content.lesson.data.content}</p> : null}
          </Card>
        ) : null}

        {content.lesson.isError || content.blocks.isError ? (
          <p className="mt-6 rounded-md border border-warning-border bg-warning-bg p-4 text-body-sm text-warning-text" role="status">
            Dars materiali hozircha yuklanmadi. Jarayon ma’lumotlari mavjud.
          </p>
        ) : null}

        {content.blocks.data?.length ? (
          <section aria-labelledby="lesson-content-heading" className="mt-12 max-w-reading">
            <h2 className="type-heading-2" id="lesson-content-heading">Dars materiali</h2>
            <div className="mt-5 space-y-5">
              {content.blocks.data.map((block) => (
                <Card elevation="none" key={block.id} padding="lg">
                  <p className="text-caption text-text-muted">{block.position}. {block.blockType}</p>
                  <h3 className="type-heading-4 mt-1">{block.title ?? 'Material'}</h3>
                  {block.description ? <p className="mt-2 text-body-sm text-text-secondary">{block.description}</p> : null}
                  <LessonContentBlockView block={block} mediaUrls={content.mediaUrls} />
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {progress.data.capabilities.canAccessCourseContent ? <Card className="mt-10 max-w-reading" elevation="none" padding="lg"><h2 className="type-heading-2">Mening qaydlarim</h2><textarea aria-label="Mening qaydlarim" className="mt-4 min-h-36 w-full rounded-md border border-border-control bg-surface p-3 text-body-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" maxLength={10000} onChange={(event) => setNoteText(event.target.value)} placeholder="Bu dars uchun shaxsiy qaydingiz..." value={noteText} /> <div className="mt-3 flex flex-wrap items-center gap-3"><Button disabled={lessonNote.save.isPending} loading={lessonNote.save.isPending} onClick={() => lessonNote.save.mutate(noteText)}>Saqlash</Button>{lessonNote.query.data ? <Button disabled={lessonNote.clear.isPending} intent="secondary" onClick={() => { lessonNote.clear.mutate(); setNoteText(''); }}>Tozalash</Button> : null}{lessonNote.save.isSuccess ? <span className="text-body-sm text-success-text" role="status">Qayd saqlandi.</span> : null}{lessonNote.save.isError ? <span className="text-body-sm text-danger-text" role="alert">Qayd saqlanmadi. Matningiz saqlanib qoldi.</span> : null}</div></Card> : null}

        <StudentVocabularyPanel enabled={Boolean(progress.data?.capabilities.canAccessCourseContent)} enrollmentId={enrollmentId} lessonId={lessonId} />
        <StudentQuizPanel enabled={Boolean(progress.data?.capabilities.canAccessCourseContent)} enrollmentId={enrollmentId} lessonId={lessonId} />

        {unavailable ? (
          <p
            className="mt-6 rounded-md border border-warning-border bg-warning-bg p-4 text-body-sm text-warning-text"
            role="status"
          >
            {unavailable}
          </p>
        ) : null}

        {lessonCompleted ? (
          <Card className="mt-8 border-success-border bg-success-bg" role="status">
            <h2 className="type-heading-3 text-success-text">Dars tugallandi</h2>
            {progress.data.status === 'COMPLETED' ? (
              <p className="mt-2 text-body-md text-success-text">Kurs ham yakunlandi.</p>
            ) : nextLesson ? (
              <Link className="mt-4 inline-flex min-h-target items-center text-button text-success-text" to={progressPaths.lesson(enrollmentId, nextLesson.id)}>
                Keyingi dars: {nextLesson.title}
              </Link>
            ) : null}
          </Card>
        ) : null}

        <section aria-labelledby="lesson-blocks-heading" className="mt-10">
          <h2 className="type-heading-2" id="lesson-blocks-heading">
            {progressMessages.lesson.blocks}
          </h2>
          {lesson.blocks.length ? (
            <ol className="mt-5 space-y-4">
              {lesson.blocks.map((block) => {
                const isPending = mutationPending && pendingResourceId === block.id;
                return (
                  <li key={block.id}>
                    <Card elevation="none" padding="lg">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-caption text-text-muted">
                            {progressMessages.blockType[block.blockType]}
                          </p>
                          <h3 className="type-heading-4 mt-1">
                            {block.title ??
                              `${block.position}-${progressMessages.lesson.blockFallback}`}
                          </h3>
                        </div>
                        <BlockStatusIndicator block={block} />
                      </div>
                      {block.capabilities.canCompleteBlock ? (
                        <Button
                          className="mt-5"
                          disabled={!isOnline || mutationPending}
                          loading={isPending}
                          onClick={() =>
                            completeBlock({ ...completionInput, resourceId: block.id })
                          }
                        >
                          {progressMessages.lesson.completeBlock}
                        </Button>
                      ) : null}
                      {block.capabilities.canReopenBlock ? (
                        <Button
                          className="mt-5"
                          disabled={!isOnline || mutationPending}
                          intent="secondary"
                          loading={isPending}
                          onClick={() => reopenBlock({ ...completionInput, resourceId: block.id })}
                        >
                          {progressMessages.lesson.reopenBlock}
                        </Button>
                      ) : null}
                    </Card>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="mt-5">
              <ProgressEmptyState
                body={progressMessages.lesson.noBlocks}
                title={progressMessages.lesson.blocks}
              />
            </div>
          )}
        </section>
      </main>

      <div className="safe-area-bottom fixed inset-x-0 bottom-0 z-sticky border-t border-border-decorative bg-surface p-3 shadow-navigation md:sticky md:mx-auto md:mt-6 md:max-w-content md:rounded-lg md:border">
        <div className="mx-auto grid max-w-content gap-2">
          {lesson.capabilities.canCompleteLesson ? (
            <Button
              disabled={!isOnline || mutationPending}
              loading={mutationPending && pendingResourceId === lesson.id}
              onClick={() => completeLesson({ ...completionInput, resourceId: lesson.id })}
              width="full"
            >
              {progressMessages.lesson.complete}
            </Button>
          ) : null}
          {lesson.capabilities.canReopenLesson ? (
            <Button
              disabled={!isOnline || mutationPending}
              intent="secondary"
              loading={mutationPending && pendingResourceId === lesson.id}
              onClick={() => reopenLesson({ ...completionInput, resourceId: lesson.id })}
              width="full"
            >
              {progressMessages.lesson.reopen}
            </Button>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            {previousLesson ? (
              <Link
                aria-label={`${progressMessages.lesson.previousLabel}: ${previousLesson.title}`}
                className="inline-flex min-h-target items-center justify-center rounded-md border border-action-secondary-border bg-action-secondary-bg px-3 py-2 text-button text-action-secondary-text no-underline visited:text-action-secondary-text"
                to={progressPaths.lesson(enrollmentId, previousLesson.id)}
              >
                {progressMessages.common.previous}
              </Link>
            ) : (
              <span aria-hidden="true" />
            )}
            {nextLesson ? (
              <Link
                aria-label={`${progressMessages.lesson.nextLabel}: ${nextLesson.title}`}
                className="inline-flex min-h-target items-center justify-center rounded-md border border-action-secondary-border bg-action-secondary-bg px-3 py-2 text-button text-action-secondary-text no-underline visited:text-action-secondary-text"
                to={progressPaths.lesson(enrollmentId, nextLesson.id)}
              >
                {progressMessages.common.next}
              </Link>
            ) : (
              <span aria-hidden="true" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
