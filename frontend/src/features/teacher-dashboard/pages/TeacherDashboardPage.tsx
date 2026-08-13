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

  const totalCourses = courses.data?.pagination.totalItems ?? 0;

  return (
    <>
      {/* ── PAGE HEADER ──────────────────────────────────── */}
      <header className="mb-8 border-b border-border-decorative pb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-text">
          {teacherDashboardMessages.eyebrow}
        </p>
        <h1 className="type-heading-1 mt-2">{teacherDashboardMessages.title}</h1>
        <p className="mt-2 max-w-reading text-base text-text-secondary">
          {teacherDashboardMessages.description}
        </p>
      </header>

      {/* ── STATS ROW ────────────────────────────────────── */}
      {courses.data && (
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border-decorative bg-surface p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Jami kurslar
            </p>
            <p className="mt-2 text-3xl font-extrabold tabular-nums text-text-primary">
              {totalCourses}
            </p>
          </div>
          <div className="rounded-xl border border-border-decorative bg-surface p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Nashr etilgan
            </p>
            <p className="mt-2 text-3xl font-extrabold tabular-nums text-text-primary">
              {courses.data.items.filter((c) => c.status === 'PUBLISHED').length}
            </p>
          </div>
          <div className="rounded-xl border border-border-decorative bg-surface p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Joriy sahifa
            </p>
            <p className="mt-2 text-3xl font-extrabold tabular-nums text-text-primary">
              {page} / {responsePage?.totalPages ?? 1}
            </p>
          </div>
        </div>
      )}

      {/* ── COURSE LIST ──────────────────────────────────── */}
      <section aria-labelledby="assigned-courses-heading">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="type-heading-2" id="assigned-courses-heading">
            {teacherDashboardMessages.assignedCourses}
          </h2>
          {courses.data && (
            <p className="text-sm text-text-muted">
              {teacherDashboardMessages.assignedCount(courses.data.pagination.totalItems)}
            </p>
          )}
        </div>

        {courses.isPending || isOutOfRange ? (
          <TeacherDashboardSkeleton />
        ) : null}

        {courses.isError && !courses.data ? (
          <ReportingError
            error={courses.error}
            headingLevel="h3"
            onRetry={() => void courses.refetch()}
          />
        ) : null}

        {courses.data && !isOutOfRange ? (
          <>
            <ReportingRefreshStatus
              error={courses.error}
              isError={courses.isError}
              isFetching={courses.isFetching}
            />
            {courses.data.items.length ? (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {courses.data.items.map((course) => (
                  <TeacherCourseOverviewCard course={course} key={course.id} />
                ))}
              </div>
            ) : (
              <ProgressEmptyState
                body={teacherDashboardMessages.empty.body}
                headingLevel="h3"
                title={teacherDashboardMessages.empty.title}
              />
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
