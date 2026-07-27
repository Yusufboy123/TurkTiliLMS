import { Card } from '../../../components';
import { progressMessages } from '../../../locales/uz-Latn/progress';

interface ProgressStatisticsProps {
  activeCourseCount: number;
  completedCourseCount: number;
}

export function ProgressStatistics({
  activeCourseCount,
  completedCourseCount,
}: ProgressStatisticsProps) {
  const items = [
    { label: progressMessages.progress.activeCount, value: activeCourseCount },
    { label: progressMessages.progress.completedCount, value: completedCourseCount },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <Card elevation="none" key={item.label} padding="sm">
          <dt className="text-caption text-text-muted">{item.label}</dt>
          <dd className="mt-1 text-heading-2 font-semibold text-text-primary">{item.value}</dd>
        </Card>
      ))}
    </dl>
  );
}
