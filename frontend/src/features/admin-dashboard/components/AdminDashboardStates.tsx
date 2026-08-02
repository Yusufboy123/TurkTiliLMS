import { Button, Card, PermissionDeniedState } from '../../../components';
import { adminDashboardMessages } from '../../../locales/uz-Latn/admin-dashboard';
import { isAdminDashboardPermissionDenied } from '../admin-dashboard.errors';

export function AdminDashboardError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  if (isAdminDashboardPermissionDenied(error)) {
    return <PermissionDeniedState contained />;
  }

  return (
    <Card className="mt-8 border-danger-border bg-danger-bg" role="alert">
      <h2 className="type-heading-3 text-danger-text">{adminDashboardMessages.error.title}</h2>
      <p className="mt-2 text-body-sm text-danger-text">{adminDashboardMessages.error.body}</p>
      <Button className="mt-4" intent="secondary" onClick={onRetry}>
        {adminDashboardMessages.error.retry}
      </Button>
    </Card>
  );
}

export function AdminDashboardRefreshStatus({
  hasError,
  isFetching,
}: {
  hasError: boolean;
  isFetching: boolean;
}) {
  if (!isFetching && !hasError) return null;

  return (
    <p
      aria-live="polite"
      className={hasError ? 'text-caption text-danger-text' : 'text-caption text-text-muted'}
      role="status"
    >
      {hasError ? adminDashboardMessages.error.body : adminDashboardMessages.refreshing}
    </p>
  );
}
