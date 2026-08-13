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
      <h2 className="type-heading-3 mb-4 flex items-center gap-2" id={headingId}>
        <span className="inline-block h-4 w-0.5 rounded-full bg-action-primary-bg" aria-hidden="true" />
        {title}
      </h2>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card
            className="flex min-w-0 flex-col gap-1 transition-shadow hover:shadow-sm"
            key={metric.label}
            padding="lg"
          >
            <dt className="overflow-wrap-anywhere text-xs font-semibold uppercase tracking-wide text-text-muted">
              {metric.label}
            </dt>
            <dd className="break-all text-3xl font-extrabold tabular-nums text-text-primary">
              {formatAdminSummaryMetric(metric)}
            </dd>
          </Card>
        ))}
      </dl>
    </section>
  );
}
