import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { progressReportingMessages } from '../../../locales/uz-Latn/progress-reporting';
import {
  ReportingEmptyState,
  ReportingError,
  ReportingFilters,
  ReportingPagination,
  ReportingRefreshStatus,
  ReportingSkeleton,
  ReportingSummary,
  StudentProgressTable,
} from '../components';
import { useTeacherCourseReporting } from '../hooks/use-progress-reporting';
import { progressReportingPaths } from '../progress-reporting.routes';
import { reportingQueryFrom, reportingSearchParams } from '../utils/reporting-query';

export default function TeacherCourseProgressPage() {
  const { courseId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const serializedSearch = searchParams.toString();
  const query = useMemo(
    () => reportingQueryFrom(new URLSearchParams(serializedSearch)),
    [serializedSearch],
  );
  const report = useTeacherCourseReporting(courseId, query);

  if (report.isPending) return <ReportingSkeleton />;
  if (report.isError && !report.data) {
    return <ReportingError error={report.error} onRetry={() => void report.refetch()} />;
  }
  if (!report.data) return <ReportingEmptyState />;

  return (
    <>
      <header>
        <p className="text-label-md text-brand-text">{progressReportingMessages.title.teacher}</p>
        <h1 className="type-heading-1 mt-2 break-words">{report.data.course.title}</h1>
        <p className="mt-2 text-body-sm text-text-secondary">
          {progressReportingMessages.common.curriculum}: {report.data.curriculumVersion}
        </p>
      </header>
      <ReportingRefreshStatus
        error={report.error}
        isError={report.isError}
        isFetching={report.isFetching}
      />
      <ReportingSummary
        active={report.data.activeEnrollmentCount}
        average={report.data.averageProgressPercentage}
        cancelled={report.data.cancelledEnrollmentCount}
        completed={report.data.completedEnrollmentCount}
        suspended={report.data.suspendedEnrollmentCount}
      />
      <ReportingFilters
        onApply={(next) => setSearchParams(reportingSearchParams(next))}
        query={query}
      />
      {report.data.items.length ? (
        <StudentProgressTable
          detailPath={(enrollmentId) =>
            progressReportingPaths.teacherEnrollment(courseId, enrollmentId)
          }
          items={report.data.items}
          query={query}
        />
      ) : (
        <div className="mt-6">
          <ReportingEmptyState />
        </div>
      )}
      <ReportingPagination
        onPageChange={(page) => setSearchParams(reportingSearchParams({ ...query, page }))}
        pagination={report.data.pagination}
      />
    </>
  );
}
