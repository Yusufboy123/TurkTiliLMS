import { ProgressActionLink } from '../../progress/components';
import { progressReportingPaths } from '../../progress-reporting';
import { useAuth } from '../../auth';
import { adminDashboardMessages } from '../../../locales/uz-Latn/admin-dashboard';
import {
  AdminDashboardError,
  AdminDashboardRefreshStatus,
  AdminDashboardSkeleton,
  AdminSummarySection,
  type AdminSummaryMetric,
} from '../components';
import { isAdminDashboardPermissionDenied } from '../admin-dashboard.errors';
import { canAccessAdminDashboard } from '../admin-dashboard.routes';
import { useAdminDashboardSummary } from '../hooks/use-admin-dashboard';
import { formatAdminDashboardSnapshot } from '../admin-dashboard.formatters';

export default function AdminDashboardPage() {
  const auth = useAuth();
  const isAuthorized = auth.status === 'authenticated' && canAccessAdminDashboard(auth);
  const summary = useAdminDashboardSummary(isAuthorized);

  const data = summary.data;
  const permissionDenied =
    summary.isError && !data && isAdminDashboardPermissionDenied(summary.error);
  const sections: readonly {
    headingId: string;
    metrics: readonly AdminSummaryMetric[];
    title: string;
  }[] = data
    ? [
        {
          headingId: 'admin-users-summary',
          title: adminDashboardMessages.sections.users,
          metrics: [
            { label: adminDashboardMessages.metrics.total, value: data.users.total },
            { label: adminDashboardMessages.metrics.active, value: data.users.active },
            { label: adminDashboardMessages.metrics.suspended, value: data.users.suspended },
            { label: adminDashboardMessages.metrics.deactivated, value: data.users.deactivated },
            { label: adminDashboardMessages.metrics.deleted, value: data.users.deleted },
            { label: adminDashboardMessages.metrics.students, value: data.users.students },
            { label: adminDashboardMessages.metrics.teachers, value: data.users.teachers },
            {
              label: adminDashboardMessages.metrics.administrators,
              value: data.users.administrators,
            },
          ],
        },
        {
          headingId: 'admin-courses-summary',
          title: adminDashboardMessages.sections.courses,
          metrics: [
            { label: adminDashboardMessages.metrics.total, value: data.courses.total },
            { label: adminDashboardMessages.metrics.draft, value: data.courses.draft },
            { label: adminDashboardMessages.metrics.inReview, value: data.courses.inReview },
            { label: adminDashboardMessages.metrics.published, value: data.courses.published },
            { label: adminDashboardMessages.metrics.archived, value: data.courses.archived },
            { label: adminDashboardMessages.metrics.deleted, value: data.courses.deleted },
          ],
        },
        {
          headingId: 'admin-enrollments-summary',
          title: adminDashboardMessages.sections.enrollments,
          metrics: [
            { label: adminDashboardMessages.metrics.total, value: data.enrollments.total },
            { label: adminDashboardMessages.metrics.active, value: data.enrollments.active },
            { label: adminDashboardMessages.metrics.suspended, value: data.enrollments.suspended },
            { label: adminDashboardMessages.metrics.completed, value: data.enrollments.completed },
            { label: adminDashboardMessages.metrics.cancelled, value: data.enrollments.cancelled },
          ],
        },
        {
          headingId: 'admin-progress-summary',
          title: adminDashboardMessages.sections.progress,
          metrics: [
            {
              label: adminDashboardMessages.metrics.trackedEnrollments,
              value: data.progress.trackedEnrollments,
            },
            {
              label: adminDashboardMessages.metrics.averageCompletionPercentage,
              suffix: '%',
              value: data.progress.averageCompletionPercentage,
            },
          ],
        },
        {
          headingId: 'admin-certificates-summary',
          title: adminDashboardMessages.sections.certificates,
          metrics: [
            { label: adminDashboardMessages.metrics.total, value: data.certificates.total },
            { label: adminDashboardMessages.metrics.issued, value: data.certificates.issued },
            { label: adminDashboardMessages.metrics.revoked, value: data.certificates.revoked },
          ],
        },
      ]
    : [];

  if (permissionDenied) {
    return <AdminDashboardError error={summary.error} onRetry={() => void summary.refetch()} />;
  }

  return (
    <>
      <header>
        <p className="text-label-md text-brand-text">{adminDashboardMessages.eyebrow}</p>
        <h1 className="type-heading-1 mt-2">{adminDashboardMessages.title}</h1>
        <p className="mt-3 max-w-reading text-body-md text-text-secondary">
          {adminDashboardMessages.description}
        </p>
      </header>

      {summary.isPending ? <AdminDashboardSkeleton /> : null}
      {summary.isError && !data ? (
        <AdminDashboardError error={summary.error} onRetry={() => void summary.refetch()} />
      ) : null}
      {data ? (
        <div className="mt-8 space-y-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-body-sm text-text-secondary">
              <span className="font-semibold">{adminDashboardMessages.snapshot.label}:</span>{' '}
              <time dateTime={data.generatedAt}>
                {formatAdminDashboardSnapshot(data.generatedAt)}
              </time>
            </p>
            <AdminDashboardRefreshStatus
              hasError={summary.isError}
              isFetching={summary.isFetching}
            />
          </div>

          {sections.map((section) => (
            <AdminSummarySection key={section.headingId} {...section} />
          ))}

          <section aria-labelledby="admin-quick-actions">
            <h2 className="type-heading-2" id="admin-quick-actions">
              {adminDashboardMessages.sections.quickActions}
            </h2>
            <div className="mt-4">
              <ProgressActionLink to={progressReportingPaths.admin}>
                {adminDashboardMessages.quickActions.progress}
              </ProgressActionLink>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
