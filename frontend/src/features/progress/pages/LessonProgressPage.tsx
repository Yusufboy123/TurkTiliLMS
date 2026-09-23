import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, SkipLink } from '../../../components';
import { useOnlineStatus } from '../../../hooks/use-online-status';
import { progressMessages } from '../../../locales/uz-Latn/progress';
import {
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
import {
  LearnModeView,
  PracticeModeView,
  PlayerModeStepper,
  ResultModeView,
  TestModeView,
  useStudentLessonContent,
  useStudentLessonQuiz,
} from '../../student-player';
import type { LessonPlayerMode } from '../../student-player/components/PlayerModeStepper';
import { useLessonBookmark, useLessonNote } from '../../student-productivity';

function BookmarkGlyph() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path d="M6 4.5A2.5 2.5 0 0 1 8.5 2h7A2.5 2.5 0 0 1 18 4.5V21l-6-3.5L6 21V4.5Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

export default function LessonProgressPage() {
  const { enrollmentId = '', lessonId = '' } = useParams();
  const progress = useEnrollmentProgress(enrollmentId);
  const {
    completeBlock,
    completeLesson,
    completionMutation,
    reopenLesson,
    visitMutation,
  } = useProgressMutations();
  const isOnline = useOnlineStatus();
  const visitStateMachineRef = useRef(createLessonVisitStateMachine(createIdempotencyKey));

  // Player Mode State
  const [currentMode, setCurrentMode] = useState<LessonPlayerMode>('LEARN');

  const lessons = useMemo(
    () => progress.data?.sections.flatMap((section) => section.lessons) ?? [],
    [progress.data]
  );
  const lesson = lessons.find((item) => item.id === lessonId);
  const lessonIndex = lessons.findIndex((item) => item.id === lessonId);
  const previousLesson = lessonIndex > 0 ? lessons[lessonIndex - 1] : null;
  const nextLesson = lessonIndex >= 0 ? lessons[lessonIndex + 1] : null;

  const content = useStudentLessonContent(
    progress.data?.course.slug ?? '',
    lesson?.slug ?? '',
    Boolean(progress.data?.capabilities.canAccessCourseContent && lesson?.capabilities.canAccessLesson !== false)
  );

  const lessonAccessible = lesson?.capabilities.canAccessLesson !== false;
  const lessonBookmark = useLessonBookmark(lessonId);
  const lessonNote = useLessonNote(
    lessonId,
    Boolean(progress.data?.capabilities.canAccessCourseContent && lessonAccessible)
  );
  const [noteText, setNoteText] = useState('');
  const recordVisit = visitMutation.mutateAsync;

  const { latestResult } = useStudentLessonQuiz(
    enrollmentId,
    lessonId,
    Boolean(progress.data?.capabilities.canAccessCourseContent && lessonAccessible)
  );

  const quizResult = latestResult.data;
  const hasAttemptedQuiz = Boolean(quizResult);
  const passingPercentage = lesson?.mastery?.passingPercentage ?? 75;
  const quizPassed = Boolean(quizResult && quizResult.percentage >= passingPercentage);

  useEffect(() => {
    if (!progress.data || !lesson) return;

    const visitStateMachine = visitStateMachineRef.current;
    visitStateMachine.selectLesson({
      enrollmentId,
      lessonId: lesson.id,
      curriculumVersion: progress.data.curriculumVersion,
    });

    void visitStateMachine
      .attempt(
        {
          canRecordActivity: progress.data.capabilities.canRecordActivity && lessonAccessible,
          isOnline,
        },
        recordVisit
      )
      .catch(() => undefined);
  }, [enrollmentId, isOnline, lesson, lessonAccessible, progress.data, recordVisit]);

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

  const blocksData = content.blocks.data ?? [];
  const practiceHolder = blocksData.find((block) => block.isPracticeHolder);
  const practiceProgress = practiceHolder
    ? lesson.blocks.find((block) => block.id === practiceHolder.id)
    : undefined;
  const practiceCompleted = practiceProgress?.status === 'COMPLETED';

  return (
    <div className="min-h-screen bg-canvas pb-32 text-text-primary md:pb-12">
      <SkipLink targetId="lesson-main-content" />

      {/* Player Header Bar */}
      <header className="sticky top-0 z-sticky border-b border-border-decorative/80 bg-surface/95 shadow-subtle backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-content items-center justify-between gap-2 px-3 sm:gap-4 sm:px-4 md:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <Link
              aria-label={progressMessages.common.back}
              className="inline-flex min-h-target shrink-0 items-center text-button text-action-primary-text hover:underline"
              to={progressPaths.course(enrollmentId)}
            >
              <span aria-hidden="true" className="sm:hidden">←</span>
              <span className="hidden sm:inline">{progressMessages.common.back}</span>
            </Link>
            <span aria-hidden="true" className="hidden h-5 w-px shrink-0 bg-border-control sm:block" />
            <p className="min-w-0 truncate text-label-md text-text-secondary font-medium">
              {progress.data.course.title}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden rounded-full bg-action-primary-bg/10 px-3 py-1 text-caption font-bold text-action-primary-text md:inline-flex">
              {progress.data.course.level ?? '—'} Daraja
            </span>
            <Button
              aria-label={lessonBookmark.isBookmarked ? 'Saqlanganlardan olib tashlash' : 'Darsni saqlash'}
              className="shrink-0 px-3 sm:px-4"
              disabled={!progress.data.capabilities.canAccessCourseContent || lessonBookmark.isPending}
              intent="secondary"
              onClick={lessonBookmark.toggle}
              size="sm"
              startIcon={<BookmarkGlyph />}
            >
              <span className="hidden sm:inline">{lessonBookmark.isBookmarked ? 'Saqlangan' : 'Saqlash'}</span>
              <span className="sr-only sm:hidden">{lessonBookmark.isBookmarked ? 'Saqlangan' : 'Saqlash'}</span>
            </Button>
          </div>
        </div>
      </header>

      {!isOnline && (
        <div
          className="border-b border-warning-border bg-warning-bg px-4 py-3 text-center text-body-sm text-warning-text"
          role="status"
        >
          {progressMessages.common.offlineLesson}
        </div>
      )}

      <main
        className="mx-auto max-w-content px-4 py-8 md:px-6"
        id="lesson-main-content"
        tabIndex={-1}
      >
        {/* Lesson Title & Subheader */}
        <div className="max-w-reading mb-6">
          <ProgressPageHeader title={lesson.title} />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <LessonStatusBadge status={lesson.status} />
            <span className="text-caption text-text-muted">
              {content.lesson.data?.durationMinutes ?? 45} daqiqa ajratilgan
            </span>
          </div>
        </div>

        <ProgressRefreshStatus
          error={progress.error}
          isError={progress.isError}
          isFetching={progress.isFetching}
        />

        {/* Mastery Lock Warning */}
        {lesson.mastery?.locked && (() => {
          const topicPassed = lesson.mastery.previousTopicPercentage !== null && lesson.mastery.previousTopicPercentage >= (lesson.mastery.previousPassingPercentage ?? passingPercentage);
          const vocabRequired = lesson.mastery.previousVocabularyRequired;
          const vocabularyPassingPercentage = lesson.mastery.vocabularyPassingPercentage ?? passingPercentage;
          const vocabPassed = lesson.mastery.previousVocabularyPercentage !== null && lesson.mastery.previousVocabularyPercentage >= vocabularyPassingPercentage;
          const targetPath = topicPassed && vocabRequired && !vocabPassed && lesson.mastery.previousLessonId
            ? `${progressPaths.lesson(enrollmentId, lesson.mastery.previousLessonId)}#vocabulary`
            : lesson.mastery.previousLessonId
              ? progressPaths.lesson(enrollmentId, lesson.mastery.previousLessonId)
              : progressPaths.course(enrollmentId);

          return (
            <Card className="my-6 max-w-reading border-warning-border bg-warning-bg" role="status">
              <h2 className="type-heading-3 text-warning-text">🔒 Dars qulflangan</h2>
              <p className="mt-2 text-body-md text-warning-text">
                {lesson.mastery.previousLessonTitle ? `${lesson.mastery.previousLessonTitle} darsining barcha talablarini o‘zlashtiring:` : 'Avval oldingi darsni o‘zlashtiring.'}
              </p>
              {lesson.mastery.previousLessonTitle ? (
                <div className="mt-3 grid gap-1.5 text-body-sm font-medium text-warning-text">
                  <div>
                    {topicPassed
                      ? `✓ Mavzu testi: ${lesson.mastery.previousTopicPercentage}%`
                      : lesson.mastery.previousTopicPercentage === null
                        ? '✕ Mavzu testi: hali topshirilmagan'
                        : `✕ Mavzu testi: ${lesson.mastery.previousTopicPercentage}% — kamida ${lesson.mastery.previousPassingPercentage ?? passingPercentage}% kerak`}
                  </div>
                  {vocabRequired ? (
                    <div>
                      {vocabPassed
                        ? `✓ Lug‘at testi: ${lesson.mastery.previousVocabularyPercentage}%`
                        : lesson.mastery.previousVocabularyPercentage === null
                          ? '✕ Lug‘at testi: hali topshirilmagan'
                          : `✕ Lug‘at testi: ${lesson.mastery.previousVocabularyPercentage}% — kamida ${vocabularyPassingPercentage}% kerak`}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <Link
                className="mt-4 inline-flex min-h-target items-center font-bold text-button text-warning-text hover:underline"
                to={targetPath}
              >
                {topicPassed && vocabRequired && !vocabPassed
                  ? 'Lug‘at o‘rganish va testga o‘tish →'
                  : 'Oldingi darsga o‘tish →'}
              </Link>
            </Card>
          );
        })()}

        {/* Lesson Progress Bar */}
        <div className="my-5 max-w-reading">
          <ProgressBar label={progressMessages.progress.lessonProgress} value={lesson.percentage} />
        </div>

        {/* Player Mode Stepper Navigation (1. LEARN, 2. PRACTICE, 3. TEST, 4. RESULT) */}
        {!lesson.mastery?.locked && (
          <div className="max-w-reading">
            <PlayerModeStepper
              currentMode={currentMode}
              hasAttemptedQuiz={hasAttemptedQuiz}
              onSelectMode={setCurrentMode}
              practiceCompleted={practiceCompleted}
              quizPassed={quizPassed}
            />
          </div>
        )}

        {/* Mode Rendered Subtree */}
        {!lesson.mastery?.locked && (
          <div className="max-w-reading">
            {currentMode === 'LEARN' && (
              <LearnModeView
                blocks={blocksData.filter(b => !b.isPracticeHolder)}
                canAccess={Boolean(progress.data?.capabilities.canAccessCourseContent && lessonAccessible)}
                content={content.lesson.data?.content ?? null}
                enrollmentId={enrollmentId}
                lessonId={lessonId}
                mediaUrls={content.mediaUrls}
                onStartPractice={() => setCurrentMode('PRACTICE')}
                summary={content.lesson.data?.summary ?? null}
              />
            )}

            {currentMode === 'PRACTICE' && (
              <PracticeModeView
                blocks={blocksData}
                completionPending={completionMutation.isPending && completionMutation.variables?.action === 'completeBlock'}
                enrollmentId={enrollmentId}
                lessonId={lessonId}
                onCompletePractice={(practiceAnswers) => {
                  if (practiceHolder) {
                    completeBlock({ ...completionInput, resourceId: practiceHolder.id, practiceAnswers });
                  }
                }}
                onReturnToLearn={() => setCurrentMode('LEARN')}
                onStartTest={() => setCurrentMode('TEST')}
                practiceCompleted={practiceCompleted}
              />
            )}

            {currentMode === 'TEST' && (
              <TestModeView
                enabled={Boolean(progress.data?.capabilities.canAccessCourseContent && lessonAccessible && practiceCompleted)}
                enrollmentId={enrollmentId}
                lessonId={lessonId}
                passingPercentage={passingPercentage}
                onQuizSubmitted={() => setCurrentMode('RESULT')}
                onReturnToPractice={() => setCurrentMode('PRACTICE')}
              />
            )}

            {currentMode === 'RESULT' && (
              <ResultModeView
                enabled={Boolean(progress.data?.capabilities.canAccessCourseContent && lessonAccessible)}
                enrollmentId={enrollmentId}
                lessonTitle={lesson.title}
                lessonId={lessonId}
                passingPercentage={passingPercentage}
                nextLessonPath={nextLesson ? progressPaths.lesson(enrollmentId, nextLesson.id) : null}
                onGoToLearn={() => setCurrentMode('LEARN')}
                onGoToPractice={() => setCurrentMode('PRACTICE')}
                onGoToVocabulary={() => {
                  setCurrentMode('LEARN');
                  window.requestAnimationFrame(() => document.getElementById('vocabulary-heading')?.scrollIntoView({ behavior: 'smooth' }));
                }}
                onRetakeTest={() => setCurrentMode('TEST')}
                vocabularyPassed={lesson.mastery?.vocabularyPassed ?? true}
                vocabularyPercentage={lesson.mastery?.latestVocabularyPercentage ?? null}
                vocabularyRequired={lesson.mastery?.vocabularyRequired ?? false}
              />
            )}
          </div>
        )}

        {/* Student Personal Notes (Available in LEARN mode or footer) */}
        {currentMode === 'LEARN' && lessonAccessible && progress.data.capabilities.canAccessCourseContent && (
          <Card className="mt-12 max-w-reading border-border-decorative bg-surface" elevation="none" padding="lg">
            <h2 className="type-heading-3 text-text-primary">Mening qaydlarim</h2>
            <p className="mt-1 text-body-sm text-text-secondary" id="lesson-note-hint">
              Ushbu dars bo‘yicha shaxsiy eslatmalaringizni yozib qo‘ying.
            </p>
            <textarea
              aria-label="Mening qaydlarim"
              aria-describedby="lesson-note-hint lesson-note-count"
              className="mt-4 min-h-32 w-full resize-y rounded-lg border border-border-control bg-surface p-3 text-body-md shadow-subtle transition-shadow placeholder:text-text-muted focus:border-action-primary-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none"
              maxLength={10000}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Bu dars uchun shaxsiy qaydingiz..."
              value={noteText}
            />
            <p className="mt-2 text-right text-caption text-text-muted" id="lesson-note-count">{noteText.length} / 10 000</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button disabled={lessonNote.save.isPending} loading={lessonNote.save.isPending} onClick={() => lessonNote.save.mutate(noteText)}>
                Saqlash
              </Button>
              {lessonNote.query.data && (
                <Button
                  disabled={lessonNote.clear.isPending}
                  intent="secondary"
                  onClick={() => {
                    lessonNote.clear.mutate();
                    setNoteText('');
                  }}
                >
                  Tozalash
                </Button>
              )}
              {lessonNote.save.isSuccess && (
                <span className="text-body-sm text-success-text font-semibold" role="status">
                  ✓ Qayd saqlandi.
                </span>
              )}
              {lessonNote.save.isError && (
                <span className="text-body-sm text-danger-text font-semibold" role="alert">
                  Qayd saqlanmadi. Matningiz saqlanib qoldi.
                </span>
              )}
            </div>
          </Card>
        )}

        {unavailable && (
          <p className="mt-6 max-w-reading rounded-md border border-warning-border bg-warning-bg p-4 text-body-sm text-warning-text" role="status">
            {unavailable}
          </p>
        )}

        {lessonCompleted && (
          <Card className="mt-8 max-w-reading border-success-border bg-success-bg" role="status">
            <h2 className="type-heading-3 text-success-text">✓ Dars muvaffaqiyatli tugallandi</h2>
            {progress.data.status === 'COMPLETED' ? (
              <p className="mt-2 text-body-md text-success-text">Butun A1 kursi ham yakunlandi!</p>
            ) : nextLesson ? (
              <Link className="mt-4 inline-flex min-h-target items-center text-button text-success-text hover:underline" to={progressPaths.lesson(enrollmentId, nextLesson.id)}>
                Keyingi dars: {nextLesson.title} →
              </Link>
            ) : null}
          </Card>
        )}
      </main>

      {/* Sticky Bottom Navigation */}
      <div className="safe-area-bottom fixed inset-x-0 bottom-0 z-sticky border-t border-border-decorative bg-surface p-3 shadow-navigation md:sticky md:mx-auto md:mt-8 md:max-w-content md:rounded-lg md:border">
        <div className="mx-auto grid max-w-content gap-2">
          {lesson.capabilities.canCompleteLesson && (
            <Button
              disabled={!isOnline || mutationPending}
              loading={mutationPending && pendingResourceId === lesson.id}
              onClick={() => completeLesson({ ...completionInput, resourceId: lesson.id })}
              width="full"
            >
              {progressMessages.lesson.complete}
            </Button>
          )}
          {lesson.capabilities.canReopenLesson && (
            <Button
              disabled={!isOnline || mutationPending}
              intent="secondary"
              loading={mutationPending && pendingResourceId === lesson.id}
              onClick={() => reopenLesson({ ...completionInput, resourceId: lesson.id })}
              width="full"
            >
              {progressMessages.lesson.reopen}
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2">
            {previousLesson ? (
              <Link
                aria-label={`${progressMessages.lesson.previousLabel}: ${previousLesson.title}`}
                className="inline-flex min-h-target items-center justify-center rounded-md border border-action-secondary-border bg-action-secondary-bg px-3 py-2 text-button text-action-secondary-text no-underline visited:text-action-secondary-text hover:bg-subtle"
                to={progressPaths.lesson(enrollmentId, previousLesson.id)}
              >
                ← {progressMessages.common.previous}
              </Link>
            ) : (
              <span aria-hidden="true" />
            )}
            {nextLesson ? (
              <Link
                aria-label={`${progressMessages.lesson.nextLabel}: ${nextLesson.title}`}
                className="inline-flex min-h-target items-center justify-center rounded-md border border-action-secondary-border bg-action-secondary-bg px-3 py-2 text-button text-action-secondary-text no-underline visited:text-action-secondary-text hover:bg-subtle"
                to={progressPaths.lesson(enrollmentId, nextLesson.id)}
              >
                {progressMessages.common.next} →
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
