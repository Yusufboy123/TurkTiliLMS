import { Link } from 'react-router-dom';
import { Card } from '../../../components';
import { progressMessages } from '../../../locales/uz-Latn/progress';
import type { LessonProgress } from '../types/progress.types';
import { progressPaths } from '../progress.routes';
import { LessonStatusBadge } from './LessonStatusBadge';
import { ProgressBar } from './ProgressBar';

interface LessonProgressCardProps {
  enrollmentId: string;
  lesson: LessonProgress;
}

export function LessonProgressCard({ enrollmentId, lesson }: LessonProgressCardProps) {
  return (
    <Card elevation="none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h4 className="type-heading-4">{lesson.title}</h4>
        <LessonStatusBadge status={lesson.status} />
      </div>
      <div className="mt-4">
        <ProgressBar label={progressMessages.progress.lessonProgress} value={lesson.percentage} />
      </div>
      <p className="mt-3 text-caption text-text-muted">
        {lesson.completedEligibleBlocks}/{lesson.totalEligibleBlocks}{' '}
        {progressMessages.progress.blocks}
      </p>
      <Link
        className="mt-4 inline-flex min-h-target items-center text-button"
        to={progressPaths.lesson(enrollmentId, lesson.id)}
      >
        {progressMessages.common.open}
      </Link>
    </Card>
  );
}
