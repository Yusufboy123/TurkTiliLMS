import { Card } from '../../../components';
import { progressReportingMessages } from '../../../locales/uz-Latn/progress-reporting';

interface ReportingSummaryProps {
  active: number;
  average: number;
  cancelled?: number;
  completed: number;
  suspended?: number;
  total?: number;
}

export function ReportingSummary({
  active,
  average,
  cancelled,
  completed,
  suspended,
  total,
}: ReportingSummaryProps) {
  const items = [
    ...(total === undefined
      ? []
      : [{ label: progressReportingMessages.summary.total, value: String(total) }]),
    { label: progressReportingMessages.summary.active, value: String(active) },
    ...(suspended === undefined
      ? []
      : [{ label: progressReportingMessages.summary.suspended, value: String(suspended) }]),
    { label: progressReportingMessages.summary.completed, value: String(completed) },
    ...(cancelled === undefined
      ? []
      : [{ label: progressReportingMessages.summary.cancelled, value: String(cancelled) }]),
    { label: progressReportingMessages.summary.average, value: `${average}%` },
  ];
  return (
    <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => (
        <Card elevation="none" key={item.label}>
          <dt className="text-caption text-text-secondary">{item.label}</dt>
          <dd className="mt-2 text-heading-3 font-semibold">{item.value}</dd>
        </Card>
      ))}
    </dl>
  );
}
