import { progressMessages } from '../../../locales/uz-Latn/progress';
import {
  ActiveCourseList,
  ProgressError,
  ProgressPageHeader,
  ProgressRefreshStatus,
  ProgressSkeleton,
  ProgressStatistics,
  ResumeLearningPanel,
} from '../components';
import { useProgressSummary } from '../hooks/use-progress-queries';

export default function StudentDashboardPage() {
  const summary = useProgressSummary(5);

  if (summary.isPending) return <ProgressSkeleton />;
  if (summary.isError && !summary.data) {
    return <ProgressError error={summary.error} onRetry={() => void summary.refetch()} />;
  }

  return (
    <>
      <ProgressPageHeader
        description={progressMessages.dashboard.description}
        title={progressMessages.dashboard.title}
      />

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
        <ActiveCourseList
          courses={summary.data.activeCourses}
          emptyBody={progressMessages.dashboard.noCoursesBody}
          emptyTitle={progressMessages.dashboard.noCoursesTitle}
        />
      </section>
    </>
  );
}
