import { Button } from '../../../components';
import { progressReportingMessages } from '../../../locales/uz-Latn/progress-reporting';
import type { Pagination } from '../../progress';

interface ReportingPaginationProps {
  pagination: Pagination;
  onPageChange: (page: number) => void;
}

export function ReportingPagination({ pagination, onPageChange }: ReportingPaginationProps) {
  if (pagination.totalPages <= 1) return null;
  return (
    <nav
      aria-label={progressReportingMessages.table.caption}
      className="mt-6 flex flex-wrap items-center justify-between gap-3"
    >
      <Button
        disabled={pagination.page <= 1}
        intent="secondary"
        onClick={() => onPageChange(pagination.page - 1)}
      >
        {progressReportingMessages.common.previous}
      </Button>
      <span aria-live="polite" className="text-body-sm text-text-secondary">
        {progressReportingMessages.common.page} {pagination.page}/{pagination.totalPages}
      </span>
      <Button
        disabled={pagination.page >= pagination.totalPages}
        intent="secondary"
        onClick={() => onPageChange(pagination.page + 1)}
      >
        {progressReportingMessages.common.next}
      </Button>
    </nav>
  );
}
