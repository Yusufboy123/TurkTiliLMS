import { progressMessages } from '../../../locales/uz-Latn/progress';
import { toProgressClientError } from '../api/progress.api';

interface ProgressRefreshStatusProps {
  error: unknown;
  isError: boolean;
  isFetching: boolean;
}

export function ProgressRefreshStatus({ error, isError, isFetching }: ProgressRefreshStatusProps) {
  if (!isFetching && !isError) return null;

  return (
    <p
      aria-live="polite"
      className={`mb-4 text-caption ${isError ? 'text-danger-text' : 'text-text-muted'}`}
      role="status"
    >
      {isError ? toProgressClientError(error).message : progressMessages.common.refreshing}
    </p>
  );
}
