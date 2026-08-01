import { Card, Skeleton } from '../../../components';
import { teacherDashboardMessages } from '../../../locales/uz-Latn/teacher-dashboard';

export function TeacherDashboardSkeleton() {
  return (
    <div aria-label={teacherDashboardMessages.loading} className="space-y-4" role="status">
      <Skeleton className="h-7 w-2/5" shape="text" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Card aria-hidden="true" key={index} padding="lg">
            <Skeleton className="h-6 w-3/5" shape="text" />
            <Skeleton className="mt-4 h-4 w-full" shape="text" />
            <Skeleton className="mt-3 h-4 w-2/5" shape="text" />
          </Card>
        ))}
      </div>
    </div>
  );
}
