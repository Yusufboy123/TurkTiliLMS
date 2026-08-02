import { Card, Skeleton } from '../../../components';
import { adminDashboardMessages } from '../../../locales/uz-Latn/admin-dashboard';

export function AdminDashboardSkeleton() {
  return (
    <div
      aria-label={adminDashboardMessages.loading}
      aria-busy="true"
      className="mt-8 space-y-8"
      role="status"
    >
      {Array.from({ length: 5 }, (_, sectionIndex) => (
        <section aria-hidden="true" key={sectionIndex}>
          <Skeleton className="h-7 w-2/5" shape="text" />
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 3 }, (_, cardIndex) => (
              <Card key={cardIndex} padding="lg">
                <Skeleton className="h-4 w-3/5" shape="text" />
                <Skeleton className="mt-4 h-8 w-2/5" shape="text" />
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
