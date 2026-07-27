import type { CourseProgressSummary } from '../types/progress.types';
import { ProgressCard } from './ProgressCard';
import { ProgressEmptyState } from './ProgressEmptyState';

interface ActiveCourseListProps {
  courses: CourseProgressSummary[];
  emptyBody: string;
  emptyTitle: string;
}

export function ActiveCourseList({ courses, emptyBody, emptyTitle }: ActiveCourseListProps) {
  if (!courses.length) {
    return (
      <div className="mt-5">
        <ProgressEmptyState body={emptyBody} title={emptyTitle} />
      </div>
    );
  }

  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {courses.map((course) => (
        <ProgressCard key={course.enrollmentId} progress={course} />
      ))}
    </div>
  );
}
