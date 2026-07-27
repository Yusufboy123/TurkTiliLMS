import { Card } from '../../../components';
import { progressMessages } from '../../../locales/uz-Latn/progress';
import type { CompletedCourse } from '../types/progress.types';
import { formatProgressDate } from '../utils/progress-format';
import { ProgressRing } from './ProgressRing';

export function CompletedCourseCard({ course }: { course: CompletedCourse }) {
  return (
    <Card className="flex items-center gap-5" padding="lg">
      <ProgressRing label={course.course.title} size="sm" value={course.percentage} />
      <div className="min-w-0">
        <h2 className="type-heading-4 overflow-wrap-anywhere">{course.course.title}</h2>
        <p className="mt-2 text-body-sm text-text-secondary">
          {course.completedLessons}/{course.totalEligibleLessons}{' '}
          {progressMessages.progress.lessons}
        </p>
        <p className="mt-1 text-caption text-text-muted">
          {progressMessages.completed.finishedAt}: {formatProgressDate(course.completedAt)}
        </p>
      </div>
    </Card>
  );
}
