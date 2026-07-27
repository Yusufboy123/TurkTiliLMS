import { Button, Card } from '../../../components';
import { progressMessages } from '../../../locales/uz-Latn/progress';
import { toProgressClientError } from '../api/progress.api';

interface ProgressErrorProps {
  error: unknown;
  onRetry: () => void;
}

export function ProgressError({ error, onRetry }: ProgressErrorProps) {
  const clientError = toProgressClientError(error);

  return (
    <Card className="border-danger-border bg-danger-bg" role="alert">
      <h2 className="type-heading-4 text-danger-text">{progressMessages.errors.title}</h2>
      <p className="mt-2 text-body-sm text-danger-text">{clientError.message}</p>
      <Button className="mt-4" intent="secondary" onClick={onRetry}>
        {progressMessages.common.retry}
      </Button>
    </Card>
  );
}
