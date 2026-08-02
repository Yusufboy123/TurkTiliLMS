import { Card } from '../../../components';
import { formatAdminSummaryMetric } from '../admin-dashboard.formatters';
import type { AdminSummaryMetric } from '../types/admin-dashboard.types';

interface AdminSummarySectionProps {
  readonly headingId: string;
  readonly metrics: readonly AdminSummaryMetric[];
  readonly title: string;
}

export type { AdminSummaryMetric } from '../types/admin-dashboard.types';

export function AdminSummarySection({ headingId, metrics, title }: AdminSummarySectionProps) {
  return (
    <section aria-labelledby={headingId}>
      <h2 className="type-heading-2" id={headingId}>
        {title}
      </h2>
      <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card className="flex min-w-0 flex-col gap-2" key={metric.label} padding="lg">
            <dt className="overflow-wrap-anywhere text-label-md text-text-secondary">
              {metric.label}
            </dt>
            <dd className="break-all type-heading-2 tabular-nums">
              {formatAdminSummaryMetric(metric)}
            </dd>
          </Card>
        ))}
      </dl>
    </section>
  );
}
