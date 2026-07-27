import { Card, Skeleton } from '../../../components';
import { progressMessages } from '../../../locales/uz-Latn/progress';

export function ProgressSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div aria-label={progressMessages.common.loading} className="space-y-4" role="status">
      <Skeleton className="h-7 w-2/5" shape="text" />
      {Array.from({ length: cards }, (_, index) => (
        <Card aria-hidden="true" key={index} padding="lg">
          <Skeleton className="h-6 w-3/5" shape="text" />
          <Skeleton className="mt-4 h-3 w-full" shape="text" />
          <Skeleton className="mt-3 h-4 w-2/5" shape="text" />
        </Card>
      ))}
    </div>
  );
}
