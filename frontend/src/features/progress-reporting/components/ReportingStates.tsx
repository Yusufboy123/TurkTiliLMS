import axios from 'axios';
import { Button, Card, PermissionDeniedState } from '../../../components';
import { progressMessages } from '../../../locales/uz-Latn/progress';
import { progressReportingMessages } from '../../../locales/uz-Latn/progress-reporting';
import { toProgressClientError } from '../../progress';
import { ProgressEmptyState, ProgressSkeleton } from '../../progress/components';
export { PermissionDeniedState };

export function ReportingSkeleton() {
  return <ProgressSkeleton cards={5} />;
}

export function ReportingEmptyState() {
  return (
    <ProgressEmptyState
      body={progressReportingMessages.empty.body}
      title={progressReportingMessages.empty.title}
    />
  );
}

export function ReportingError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  if (axios.isAxiosError(error) && error.response?.status === 403) {
    return <PermissionDeniedState contained />;
  }
  const safeError = toProgressClientError(error);
  return (
    <Card className="border-danger-border bg-danger-bg" role="alert">
      <h1 className="type-heading-3 text-danger-text">{progressMessages.errors.title}</h1>
      <p className="mt-2 text-body-sm text-danger-text">{safeError.message}</p>
      <Button className="mt-4" intent="secondary" onClick={onRetry}>
        {progressReportingMessages.common.retry}
      </Button>
    </Card>
  );
}

export function ReportingRefreshStatus({
  error,
  isError,
  isFetching,
}: {
  error: unknown;
  isError: boolean;
  isFetching: boolean;
}) {
  if (!isFetching && !isError) return null;
  return (
    <p
      aria-live="polite"
      className={isError ? 'text-caption text-danger-text' : 'text-caption text-text-muted'}
      role="status"
    >
      {isError ? toProgressClientError(error).message : progressReportingMessages.common.refreshing}
    </p>
  );
}
