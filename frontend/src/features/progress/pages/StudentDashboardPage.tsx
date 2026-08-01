import { Link } from 'react-router-dom';
import { useAuth } from '../../auth';
import { progressMessages } from '../../../locales/uz-Latn/progress';
import {
  ActiveCourseList,
  DashboardCompletedCourseCard,
  ProgressEmptyState,
  ProgressError,
  ProgressPageHeader,
  ProgressRefreshStatus,
  ProgressSkeleton,
  ProgressStatistics,
  ResumeLearningPanel,
} from '../components';
import { useCompletedCourses, useProgressSummary } from '../hooks/use-progress-queries';
import { progressPaths } from '../progress.routes';

export const STUDENT_DASHBOARD_ACTIVE_LIMIT = 6;
export const STUDENT_DASHBOARD_COMPLETED_QUERY = {
  page: 1,
  pageSize: 3,
  sortBy: 'completedAt',
  sortDirection: 'desc',
} as const;

export default function StudentDashboardPage() {
  const auth = useAuth();
  const summary = useProgressSummary(STUDENT_DASHBOARD_ACTIVE_LIMIT);
  const completed = useCompletedCourses(STUDENT_DASHBOARD_COMPLETED_QUERY);
  const studentName = auth.status === 'authenticated' ? auth.user.firstName?.trim() || null : null;

  return (
    <>
      <ProgressPageHeader
        description={progressMessages.dashboard.description}
        title={
          studentName
            ? progressMessages.dashboard.welcome(studentName)
            : progressMessages.dashboard.title
        }
      />

      {summary.isPending ? <ProgressSkeleton cards={4} /> : null}
      {summary.isError && !summary.data ? (
        <ProgressError error={summary.error} onRetry={() => void summary.refetch()} />
      ) : null}
      {summary.data ? (
        <>
          <ProgressRefreshStatus
            error={summary.error}
            isError={summary.isError}
            isFetching={summary.isFetching}
          />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
            <div>
              <ResumeLearningPanel resume={summary.data.resumeLearning} />
            </div>
            <ProgressStatistics
              activeCourseCount={summary.data.activeCourseCount}
              completedCourseCount={summary.data.completedCourseCount}
            />
          </div>

          <section aria-labelledby="current-courses-heading" className="mt-10">
            <h2 className="type-heading-2" id="current-courses-heading">
              {progressMessages.dashboard.currentCourses}
            </h2>
            <p className="mt-2 max-w-reading text-body-md text-text-secondary">
              {progressMessages.dashboard.currentCoursesDescription}
            </p>
            <ActiveCourseList
              courses={summary.data.activeCourses}
              emptyBody={progressMessages.dashboard.noCoursesBody}
              emptyTitle={progressMessages.dashboard.noCoursesTitle}
            />
          </section>
        </>
      ) : null}

      <section aria-labelledby="completed-courses-heading" className="mt-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="type-heading-2" id="completed-courses-heading">
              {progressMessages.dashboard.completedCourses}
            </h2>
            <p className="mt-2 max-w-reading text-body-md text-text-secondary">
              {progressMessages.dashboard.completedCoursesDescription}
            </p>
          </div>
          <Link
            className="inline-flex min-h-target items-center text-button"
            to={progressPaths.completed}
          >
            {progressMessages.dashboard.viewAllCompleted}
          </Link>
        </div>

        {completed.isPending ? <ProgressSkeleton cards={2} /> : null}
        {completed.isError && !completed.data ? (
          <div className="mt-5">
            <ProgressError error={completed.error} onRetry={() => void completed.refetch()} />
          </div>
        ) : null}
        {completed.data ? (
          <>
            <ProgressRefreshStatus
              error={completed.error}
              isError={completed.isError}
              isFetching={completed.isFetching}
            />
            {completed.data.items.length ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {completed.data.items.map((course) => (
                  <DashboardCompletedCourseCard course={course} key={course.enrollmentId} />
                ))}
              </div>
            ) : (
              <div className="mt-5">
                <ProgressEmptyState
                  body={progressMessages.completed.emptyBody}
                  title={progressMessages.completed.emptyTitle}
                />
              </div>
            )}
          </>
        ) : null}
      </section>
    </>
  );
}
