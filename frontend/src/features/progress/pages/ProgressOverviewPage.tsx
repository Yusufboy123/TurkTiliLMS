import { Link } from 'react-router-dom';
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
import { progressPaths } from '../progress.routes';

export default function ProgressOverviewPage() {
  const summary = useProgressSummary(5);

  if (summary.isPending) return <ProgressSkeleton cards={4} />;
  if (summary.isError && !summary.data) {
    return <ProgressError error={summary.error} onRetry={() => void summary.refetch()} />;
  }

  return (
    <>
      <ProgressPageHeader
        description={progressMessages.progress.description}
        title={progressMessages.progress.title}
      />
      <ProgressRefreshStatus
        error={summary.error}
        isError={summary.isError}
        isFetching={summary.isFetching}
      />
      <ProgressStatistics
        activeCourseCount={summary.data.activeCourseCount}
        completedCourseCount={summary.data.completedCourseCount}
      />

      <section aria-labelledby="resume-heading" className="mt-8">
        <h2 className="sr-only" id="resume-heading">
          {progressMessages.resume.title}
        </h2>
        <ResumeLearningPanel resume={summary.data.resumeLearning} />
      </section>

      <section aria-labelledby="active-progress-heading" className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="type-heading-2" id="active-progress-heading">
            {progressMessages.progress.activeCourses}
          </h2>
          <Link to={progressPaths.completed}>{progressMessages.progress.completedCourses}</Link>
        </div>
        <ActiveCourseList
          courses={summary.data.activeCourses}
          emptyBody={progressMessages.progress.noProgressBody}
          emptyTitle={progressMessages.progress.noProgressTitle}
        />
      </section>
    </>
  );
}
