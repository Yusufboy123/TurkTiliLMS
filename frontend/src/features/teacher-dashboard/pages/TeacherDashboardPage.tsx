import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { teacherDashboardMessages } from '../../../locales/uz-Latn/teacher-dashboard';
import { ProgressEmptyState } from '../../progress';
import {
  ReportingError,
  ReportingPagination,
  ReportingRefreshStatus,
} from '../../progress-reporting';
import { TeacherCourseOverviewCard, TeacherDashboardSkeleton } from '../components';
import { useAssignedTeacherCourses } from '../hooks/use-teacher-dashboard';
import {
  normalizeTeacherDashboardPage,
  teacherDashboardCourseQuery,
} from '../teacher-dashboard.queries';

function safePage(value: string | null): number {
  if (!value) return 1;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default function TeacherDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = safePage(searchParams.get('page'));
  const query = useMemo(() => teacherDashboardCourseQuery(page), [page]);
  const courses = useAssignedTeacherCourses(query);
  const responsePage = courses.data?.pagination;
  const normalizedPage = responsePage
    ? normalizeTeacherDashboardPage(page, responsePage.totalPages)
    : page;
  const isOutOfRange = Boolean(responsePage && normalizedPage !== page);

  useEffect(() => {
    if (!responsePage || normalizedPage === page) return;
    setSearchParams(normalizedPage > 1 ? { page: String(normalizedPage) } : {}, { replace: true });
  }, [normalizedPage, page, responsePage, setSearchParams]);

  return (
    <>
      <header>
        <p className="text-label-md text-brand-text">{teacherDashboardMessages.eyebrow}</p>
        <h1 className="type-heading-1 mt-2">{teacherDashboardMessages.title}</h1>
        <p className="mt-3 max-w-reading text-body-md text-text-secondary">
          {teacherDashboardMessages.description}
        </p>
      </header>

      <section aria-labelledby="assigned-courses-heading" className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="type-heading-2" id="assigned-courses-heading">
              {teacherDashboardMessages.assignedCourses}
            </h2>
            {courses.data ? (
              <p className="mt-2 text-body-sm text-text-secondary">
                {teacherDashboardMessages.assignedCount(courses.data.pagination.totalItems)}
              </p>
            ) : null}
          </div>
        </div>

        {courses.isPending || isOutOfRange ? (
          <div className="mt-5">
            <TeacherDashboardSkeleton />
          </div>
        ) : null}
        {courses.isError && !courses.data ? (
          <div className="mt-5">
            <ReportingError
              error={courses.error}
              headingLevel="h3"
              onRetry={() => void courses.refetch()}
            />
          </div>
        ) : null}
        {courses.data && !isOutOfRange ? (
          <>
            <ReportingRefreshStatus
              error={courses.error}
              isError={courses.isError}
              isFetching={courses.isFetching}
            />
            {courses.data.items.length ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {courses.data.items.map((course) => (
                  <TeacherCourseOverviewCard course={course} key={course.id} />
                ))}
              </div>
            ) : (
              <div className="mt-5">
                <ProgressEmptyState
                  body={teacherDashboardMessages.empty.body}
                  headingLevel="h3"
                  title={teacherDashboardMessages.empty.title}
                />
              </div>
            )}
            <ReportingPagination
              ariaLabel={teacherDashboardMessages.paginationLabel}
              onPageChange={(nextPage) =>
                setSearchParams(nextPage > 1 ? { page: String(nextPage) } : {})
              }
              pagination={courses.data.pagination}
            />
          </>
        ) : null}
      </section>
    </>
  );
}
