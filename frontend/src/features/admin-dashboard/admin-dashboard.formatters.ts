import { adminDashboardMessages } from '../../locales/uz-Latn/admin-dashboard';
import type { AdminSummaryMetric } from './types/admin-dashboard.types';

const numberFormatter = new Intl.NumberFormat('uz-Latn-UZ');
const snapshotFormatter = new Intl.DateTimeFormat('uz-Latn-UZ', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatAdminSummaryMetric(metric: AdminSummaryMetric): string {
  return `${numberFormatter.format(metric.value)}${metric.suffix ?? ''}`;
}

export function formatAdminDashboardSnapshot(generatedAt: string): string {
  const date = new Date(generatedAt);
  return Number.isNaN(date.getTime())
    ? adminDashboardMessages.snapshot.invalid
    : snapshotFormatter.format(date);
}
