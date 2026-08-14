import { Card } from '../../../components';
import { progressMessages } from '../../../locales/uz-Latn/progress';
import type { ResumeLearning } from '../types/progress.types';
import { progressPaths } from '../progress.routes';
import { formatProgressDate } from '../utils/progress-format';
import { ProgressActionLink } from './ProgressActionLink';
import { ProgressBar } from './ProgressBar';

export function ResumeLearningCard({ resume }: { resume: ResumeLearning }) {
  return (
    <Card className="relative overflow-hidden border-info-border bg-info-bg" padding="lg">
      <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-action-primary-bg" />
      <p className="text-label-sm font-semibold uppercase tracking-[0.1em] text-info-text">{progressMessages.resume.title}</p>
      {resume.course.level ? <span className="mt-3 inline-flex rounded-full bg-surface px-3 py-1 text-label-sm font-semibold text-info-text">{resume.course.level}</span> : null}
      <p className="mt-3 text-caption font-semibold text-text-muted">Dars {resume.lesson.position}</p>
      <h2 className="type-heading-3 mt-1">{resume.lesson.title}</h2>
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
