import { useParams } from 'react-router-dom';
import { progressMessages } from '../../../locales/uz-Latn/progress';
import { CertificateEligibilityPanel } from '../../certificate-eligibility';
import {
  LessonProgressCard,
  ProgressError,
  ProgressPageHeader,
  ProgressRefreshStatus,
  ProgressSkeleton,
  ProgressSummary,
  ResumeLearningCard,
} from '../components';
import { useEnrollmentProgress } from '../hooks/use-progress-queries';

export default function CourseProgressPage() {
  const { enrollmentId = '' } = useParams();
  const progress = useEnrollmentProgress(enrollmentId);

  if (progress.isPending) return <ProgressSkeleton cards={4} />;
  if (progress.isError && !progress.data) {
    return <ProgressError error={progress.error} onRetry={() => void progress.refetch()} />;
  }

  return (
    <>
      <ProgressPageHeader
        description={progressMessages.progress.description}
        title={progress.data.course.title}
      />
      <ProgressRefreshStatus
        error={progress.error}
        isError={progress.isError}
        isFetching={progress.isFetching}
      />
      <ProgressSummary progress={progress.data} />
      <CertificateEligibilityPanel
        enrollmentId={progress.data.enrollmentId}
        scope={{ kind: 'self' }}
      />

      {progress.data.resumeTarget ? (
        <div className="mt-6">
          <ResumeLearningCard resume={progress.data.resumeTarget} />
        </div>
      ) : null}

      <section aria-labelledby="sections-heading" className="mt-10">
        <h2 className="type-heading-2" id="sections-heading">
          {progressMessages.progress.sections}
        </h2>
        <div className="mt-5 space-y-6">
          {progress.data.sections.map((section) => (
            <section
              aria-labelledby={`section-${section.id}`}
              className="rounded-lg border border-border-decorative bg-subtle p-4 md:p-6"
              key={section.id}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h3 className="type-heading-3" id={`section-${section.id}`}>
                  {section.title}
                </h3>
                <p className="text-caption text-text-muted">
                  {section.completedLessons}/{section.totalEligibleLessons}{' '}
                  {progressMessages.progress.lessons}
                </p>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {section.lessons.map((lesson) => (
                  <LessonProgressCard
                    enrollmentId={progress.data.enrollmentId}
                    key={lesson.id}
                    lesson={lesson}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </>
  );
}
