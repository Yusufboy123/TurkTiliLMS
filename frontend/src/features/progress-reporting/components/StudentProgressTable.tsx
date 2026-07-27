import { Link } from 'react-router-dom';
import { Badge, Card } from '../../../components';
import { progressMessages } from '../../../locales/uz-Latn/progress';
import { progressReportingMessages } from '../../../locales/uz-Latn/progress-reporting';
import type {
  ProgressReportingQuery,
  StudentProgressReport,
} from '../types/progress-reporting.types';

interface StudentProgressTableProps {
  detailPath: (enrollmentId: string) => string;
  items: StudentProgressReport[];
  query: ProgressReportingQuery;
}

function studentName(item: StudentProgressReport) {
  const fullName = [item.student.firstName, item.student.lastName].filter(Boolean).join(' ');
  return item.student.displayName ?? (fullName || item.student.email);
}

function dateTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('uz-Latn-UZ', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : progressReportingMessages.common.noActivity;
}

function ariaSort(
  field: ProgressReportingQuery['sortBy'],
  query: ProgressReportingQuery,
): 'ascending' | 'descending' | undefined {
  return query.sortBy === field
    ? query.sortDirection === 'asc'
      ? 'ascending'
      : 'descending'
    : undefined;
}

export function StudentProgressTable({ detailPath, items, query }: StudentProgressTableProps) {
  return (
    <Card className="mt-6 overflow-hidden" elevation="none" padding="none">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-body-sm">
          <caption className="sr-only">{progressReportingMessages.table.caption}</caption>
          <thead className="bg-subtle text-label-md">
            <tr>
              <th aria-sort={ariaSort('studentName', query)} className="px-4 py-3" scope="col">
                {progressReportingMessages.table.student}
              </th>
              <th className="px-4 py-3" scope="col">
                {progressReportingMessages.table.enrollment}
              </th>
              <th aria-sort={ariaSort('percentage', query)} className="px-4 py-3" scope="col">
                {progressReportingMessages.table.progress}
              </th>
              <th className="px-4 py-3" scope="col">
                {progressReportingMessages.table.lessons}
              </th>
              <th aria-sort={ariaSort('lastActivityAt', query)} className="px-4 py-3" scope="col">
                {progressReportingMessages.table.lastActivity}
              </th>
              <th className="px-4 py-3" scope="col">
                {progressReportingMessages.table.action}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr className="border-t border-border-decorative align-top" key={item.enrollmentId}>
                <th className="max-w-64 px-4 py-4 font-semibold" scope="row">
                  <span className="break-words">{studentName(item)}</span>
                  <span className="mt-1 block break-all text-caption font-normal text-text-muted">
                    {item.student.email}
                  </span>
                </th>
                <td className="px-4 py-4">
                  <Badge>{progressMessages.status[item.enrollmentStatus]}</Badge>
                </td>
                <td className="px-4 py-4">
                  <span className="font-semibold">{item.percentage}%</span>
                  <span className="mt-1 block text-caption text-text-muted">
                    {progressMessages.status[item.progressStatus]}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  {item.completedLessons}/{item.totalEligibleLessons}
                </td>
                <td className="min-w-44 px-4 py-4">{dateTime(item.lastActivityAt)}</td>
                <td className="px-4 py-4">
                  {item.capabilities.canReadDetail ? (
                    <Link
                      className="inline-flex min-h-target items-center rounded-md px-3 py-2 text-button text-link no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      to={detailPath(item.enrollmentId)}
                    >
                      {progressReportingMessages.table.open}
                    </Link>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
