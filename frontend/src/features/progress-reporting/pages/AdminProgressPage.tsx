import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { useAdminReporting } from '../hooks/use-progress-reporting';
import { progressReportingPaths } from '../progress-reporting.routes';
import { reportingQueryFrom, reportingSearchParams } from '../utils/reporting-query';

export default function AdminProgressPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const serializedSearch = searchParams.toString();
  const query = useMemo(
    () => reportingQueryFrom(new URLSearchParams(serializedSearch)),
    [serializedSearch],
  );
  const report = useAdminReporting(query);

  if (report.isPending) return <ReportingSkeleton />;
  if (report.isError && !report.data) {
    return <ReportingError error={report.error} onRetry={() => void report.refetch()} />;
  }
  if (!report.data) return <ReportingEmptyState />;

  return (
    <>
      <header>
        <h1 className="type-heading-1">{progressReportingMessages.title.admin}</h1>
      </header>
      <ReportingRefreshStatus
        error={report.error}
        isError={report.isError}
        isFetching={report.isFetching}
      />
      <ReportingSummary
        active={report.data.activeLearners}
        average={report.data.averageProgressPercentage}
        completed={report.data.completedEnrollments}
        total={report.data.totalEnrollments}
      />
      <ReportingFilters
        admin
        onApply={(next) => setSearchParams(reportingSearchParams(next))}
        query={query}
      />
      {report.data.items.length ? (
        <StudentProgressTable
          detailPath={progressReportingPaths.adminEnrollment}
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
