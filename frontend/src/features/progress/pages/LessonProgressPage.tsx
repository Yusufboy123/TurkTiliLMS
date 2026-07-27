import { useEffect, useMemo, useRef } from 'react';
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

  return (
    <div className="min-h-screen bg-canvas pb-32 text-text-primary md:pb-8">
      <SkipLink targetId="lesson-main-content" />
      <header className="sticky top-0 z-sticky border-b border-border-decorative bg-surface">
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
        <ProgressPageHeader title={lesson.title} />
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

        {unavailable ? (
          <p
            className="mt-6 rounded-md border border-warning-border bg-warning-bg p-4 text-body-sm text-warning-text"
            role="status"
          >
            {unavailable}
          </p>
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
