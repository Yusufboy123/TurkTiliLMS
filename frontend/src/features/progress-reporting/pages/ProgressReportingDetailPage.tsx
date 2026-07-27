import { Link, useParams } from 'react-router-dom';
import { Badge, Card } from '../../../components';
import { progressMessages } from '../../../locales/uz-Latn/progress';
import { progressReportingMessages } from '../../../locales/uz-Latn/progress-reporting';
import { ProgressBar } from '../../progress/components';
import { ReportingError, ReportingRefreshStatus, ReportingSkeleton } from '../components';
import {
  useAdminEnrollmentReporting,
  useTeacherEnrollmentReporting,
} from '../hooks/use-progress-reporting';
import { progressReportingPaths } from '../progress-reporting.routes';

function studentName(student: {
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
}) {
  const fullName = [student.firstName, student.lastName].filter(Boolean).join(' ');
  return student.displayName ?? (fullName || student.email);
}

export default function ProgressReportingDetailPage({ admin = false }: { admin?: boolean }) {
  const { courseId = '', enrollmentId = '' } = useParams();
  const teacherReport = useTeacherEnrollmentReporting(
    admin ? '' : courseId,
    admin ? '' : enrollmentId,
  );
  const adminReport = useAdminEnrollmentReporting(admin ? enrollmentId : '');
  const report = admin ? adminReport : teacherReport;

  if (report.isPending) return <ReportingSkeleton />;
  if (report.isError || !report.data) {
    return <ReportingError error={report.error} onRetry={() => void report.refetch()} />;
  }

  const { progress, student } = report.data;
  const backPath = admin
    ? progressReportingPaths.admin
    : progressReportingPaths.teacherCourse(courseId);

  return (
    <>
      <Link className="inline-flex min-h-target items-center text-button text-link" to={backPath}>
        {progressReportingMessages.common.back}
      </Link>
      <header className="mt-4">
        <p className="text-label-md text-brand-text">{progressReportingMessages.title.detail}</p>
        <h1 className="type-heading-1 mt-2 break-words">{studentName(student)}</h1>
        <p className="mt-2 break-all text-body-sm text-text-secondary">{student.email}</p>
      </header>
      <ReportingRefreshStatus
        error={report.error}
        isError={report.isError}
        isFetching={report.isFetching}
      />
      <Card className="mt-6" elevation="none" padding="lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="type-heading-3">{progress.course.title}</h2>
            <p className="mt-1 text-body-sm text-text-secondary">
              {progress.completedLessons}/{progress.totalEligibleLessons}{' '}
              {progressMessages.progress.lessons}
            </p>
          </div>
          <Badge>{progressMessages.status[progress.enrollmentStatus]}</Badge>
        </div>
        <div className="mt-5 max-w-reading">
          <ProgressBar
            label={progressMessages.progress.courseProgress}
            value={progress.percentage}
          />
        </div>
      </Card>
      <section aria-labelledby="lesson-breakdown-heading" className="mt-8">
        <h2 className="type-heading-2" id="lesson-breakdown-heading">
          {progressMessages.progress.sections}
        </h2>
        <div className="mt-4 space-y-4">
          {progress.sections.map((section) => (
            <Card elevation="none" key={section.id}>
              <div className="flex flex-wrap justify-between gap-3">
                <h3 className="type-heading-4">{section.title}</h3>
                <span className="text-label-md">{section.percentage}%</span>
              </div>
              <ul className="mt-4 divide-y divide-border-decorative">
                {section.lessons.map((lesson) => (
                  <li
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                    key={lesson.id}
                  >
                    <span className="break-words text-body-sm">{lesson.title}</span>
                    <span className="text-caption text-text-secondary">
                      {progressMessages.status[lesson.status]} · {lesson.percentage}%
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
