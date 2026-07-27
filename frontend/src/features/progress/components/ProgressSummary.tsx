import type { CourseProgress } from '../types/progress.types';
import { progressMessages } from '../../../locales/uz-Latn/progress';
import { ProgressRing } from './ProgressRing';

export function ProgressSummary({ progress }: { progress: CourseProgress }) {
  return (
    <section
      aria-labelledby="course-progress-summary"
      className="flex flex-col gap-6 rounded-lg border border-border-decorative bg-surface p-6 sm:flex-row sm:items-center"
    >
      <ProgressRing label={progress.course.title} value={progress.percentage} />
      <div>
        <h2 className="type-heading-3" id="course-progress-summary">
          {progress.course.title}
        </h2>
        <p className="mt-2 text-body-md text-text-secondary">
          {progress.completedLessons}/{progress.totalEligibleLessons}{' '}
          {progressMessages.progress.lessons} · {progress.completedEligibleBlocks}/
          {progress.totalEligibleBlocks} {progressMessages.progress.blocks}
        </p>
      </div>
    </section>
  );
}
