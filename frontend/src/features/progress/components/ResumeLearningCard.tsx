import { Card } from '../../../components';
import { progressMessages } from '../../../locales/uz-Latn/progress';
import type { ResumeLearning } from '../types/progress.types';
import { progressPaths } from '../progress.routes';
import { formatProgressDate } from '../utils/progress-format';
import { ProgressActionLink } from './ProgressActionLink';
import { ProgressBar } from './ProgressBar';

export function ResumeLearningCard({ resume }: { resume: ResumeLearning }) {
  return (
    <Card className="border-info-border bg-info-bg" padding="lg">
      <p className="text-label-sm text-info-text">{progressMessages.resume.title}</p>
      <h2 className="type-heading-3 mt-2">{resume.lesson.title}</h2>
      <p className="mt-1 text-body-sm text-text-secondary">
        {resume.course.title} · {resume.section.title}
      </p>
      <div className="mt-5">
        <ProgressBar
          label={progressMessages.progress.courseProgress}
          value={resume.coursePercentage}
        />
      </div>
      <p className="mt-3 text-caption text-text-muted">
        {progressMessages.common.updated}: {formatProgressDate(resume.lastActivityAt)}
      </p>
      <ProgressActionLink
        className="mt-5"
        to={progressPaths.lesson(resume.enrollmentId, resume.lesson.id)}
      >
        {progressMessages.resume.action}
      </ProgressActionLink>
    </Card>
  );
}
