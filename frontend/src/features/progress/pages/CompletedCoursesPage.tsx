import { useState } from 'react';
import { Button } from '../../../components';
import { progressMessages } from '../../../locales/uz-Latn/progress';
import {
  CompletedCourseCard,
  ProgressEmptyState,
  ProgressError,
  ProgressPageHeader,
  ProgressRefreshStatus,
  ProgressSkeleton,
} from '../components';
import { useCompletedCourses } from '../hooks/use-progress-queries';

const PAGE_SIZE = 12;

export default function CompletedCoursesPage() {
  const [page, setPage] = useState(1);
  const completed = useCompletedCourses({
    page,
    pageSize: PAGE_SIZE,
    sortBy: 'completedAt',
    sortDirection: 'desc',
  });

  if (completed.isPending) return <ProgressSkeleton cards={4} />;
  if (completed.isError && !completed.data) {
    return <ProgressError error={completed.error} onRetry={() => void completed.refetch()} />;
  }

  return (
    <>
      <ProgressPageHeader
        description={progressMessages.completed.description}
        title={progressMessages.completed.title}
      />
      <ProgressRefreshStatus
        error={completed.error}
        isError={completed.isError}
        isFetching={completed.isFetching}
      />
      {completed.data.items.length ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {completed.data.items.map((course) => (
              <CompletedCourseCard course={course} key={course.enrollmentId} />
            ))}
          </div>
          <nav
            aria-label={progressMessages.completed.paginationLabel}
            className="mt-8 flex items-center justify-between gap-4"
          >
            <Button
              disabled={completed.data.pagination.page <= 1 || completed.isFetching}
              intent="secondary"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              {progressMessages.common.previous}
            </Button>
            <p aria-live="polite" className="text-label-sm text-text-secondary">
              {progressMessages.common.page} {completed.data.pagination.page}/
              {Math.max(1, completed.data.pagination.totalPages)}
            </p>
            <Button
              disabled={
                completed.data.pagination.page >= completed.data.pagination.totalPages ||
                completed.isFetching
              }
              intent="secondary"
              onClick={() => setPage((current) => current + 1)}
            >
              {progressMessages.common.next}
            </Button>
          </nav>
        </>
      ) : (
        <ProgressEmptyState
          body={progressMessages.completed.emptyBody}
          title={progressMessages.completed.emptyTitle}
        />
      )}
    </>
  );
}
