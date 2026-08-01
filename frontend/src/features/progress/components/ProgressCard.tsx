import { Link } from 'react-router-dom';
import { Badge, Button, Card, type BadgeIntent } from '../../../components';
import { progressMessages } from '../../../locales/uz-Latn/progress';
import type { CourseProgressSummary } from '../types/progress.types';
import { progressPaths } from '../progress.routes';
import { statusLabel, unavailableReasonLabel } from '../utils/progress-format';
import { ProgressActionLink } from './ProgressActionLink';
import { ProgressBar } from './ProgressBar';

const enrollmentIntent: Record<CourseProgressSummary['enrollmentStatus'], BadgeIntent> = {
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  CANCELLED: 'danger',
  COMPLETED: 'success',
};

export function ProgressCard({ progress }: { progress: CourseProgressSummary }) {
  const unavailable = unavailableReasonLabel(progress.capabilities.unavailableReason);
  const canResume = Boolean(progress.capabilities.canResumeLearning && progress.resumeTarget);

  return (
    <Card className="flex h-full flex-col" padding="lg">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="type-heading-4">{progress.course.title}</h3>
          <p className="mt-1 text-caption text-text-muted">{statusLabel(progress.status)}</p>
        </div>
        <Badge intent={enrollmentIntent[progress.enrollmentStatus]}>
          {statusLabel(progress.enrollmentStatus)}
        </Badge>
      </div>
      <div className="mt-5">
        <ProgressBar label={progressMessages.progress.courseProgress} value={progress.percentage} />
      </div>
      <p className="mt-3 text-body-sm text-text-secondary">
        {progress.completedLessons}/{progress.totalEligibleLessons}{' '}
        {progressMessages.progress.lessons}
      </p>
      {unavailable ? <p className="mt-3 text-body-sm text-warning-text">{unavailable}</p> : null}
      <div className="mt-auto space-y-3 pt-5">
        {canResume && progress.resumeTarget ? (
          <ProgressActionLink
            className="w-full"
            to={progressPaths.lesson(progress.enrollmentId, progress.resumeTarget.lesson.id)}
          >
            {progressMessages.dashboard.continueCourse}
          </ProgressActionLink>
        ) : (
          <>
            <Button disabled width="full">
              {progressMessages.dashboard.continueCourse}
            </Button>
            <p className="text-caption text-text-muted">
              {progressMessages.dashboard.continueUnavailable}
            </p>
          </>
        )}
        <Link
          className="inline-flex min-h-target items-center text-button"
          to={progressPaths.course(progress.enrollmentId)}
        >
          {progressMessages.dashboard.viewProgress}
        </Link>
      </div>
    </Card>
  );
}
