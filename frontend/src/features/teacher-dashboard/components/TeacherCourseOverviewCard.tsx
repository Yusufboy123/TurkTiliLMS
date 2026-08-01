import { Badge, Button, Card, Skeleton, type BadgeIntent } from '../../../components';
import { teacherDashboardMessages } from '../../../locales/uz-Latn/teacher-dashboard';
import { ProgressActionLink, ProgressBar } from '../../progress';
import {
  progressReportingPaths,
  useTeacherCourseReporting,
  type TeacherCourseProgressPage,
} from '../../progress-reporting';
import { TEACHER_DASHBOARD_REPORT_QUERY } from '../teacher-dashboard.queries';
import type { AssignedTeacherCourse, TeacherCourseStatus } from '../types/teacher-dashboard.types';

const statusIntent: Record<TeacherCourseStatus, BadgeIntent> = {
  DRAFT: 'neutral',
  IN_REVIEW: 'warning',
  PUBLISHED: 'success',
  ARCHIVED: 'neutral',
};

interface TeacherCourseReportViewProps {
  courseId: string;
  courseTitle: string;
  error: unknown;
  isPending: boolean;
  onRetry: () => void;
  report: TeacherCourseProgressPage | null;
}

export function TeacherCourseReportView({
  courseId,
  courseTitle,
  error,
  isPending,
  onRetry,
  report,
}: TeacherCourseReportViewProps) {
  if (isPending) {
    return (
      <div aria-label={teacherDashboardMessages.courseSummaryLoading} role="status">
        <Skeleton className="h-4 w-full" shape="text" />
        <Skeleton className="mt-3 h-4 w-3/5" shape="text" />
      </div>
    );
  }

  if (error && !report) {
    return (
      <div role="alert">
        <p className="text-body-sm text-danger-text">
          {teacherDashboardMessages.courseSummaryError}
        </p>
        <Button className="mt-3" intent="secondary" onClick={onRetry} size="sm">
          {teacherDashboardMessages.retry}
        </Button>
      </div>
    );
  }

  if (!report) return null;

  return (
    <>
      <dl className="grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-caption text-text-muted">
            {teacherDashboardMessages.students.total}
          </dt>
          <dd className="mt-1 text-heading-4 font-semibold">{report.pagination.totalItems}</dd>
        </div>
        <div>
          <dt className="text-caption text-text-muted">
            {teacherDashboardMessages.students.active}
          </dt>
          <dd className="mt-1 text-heading-4 font-semibold">{report.activeEnrollmentCount}</dd>
        </div>
        <div>
          <dt className="text-caption text-text-muted">
            {teacherDashboardMessages.students.completed}
          </dt>
          <dd className="mt-1 text-heading-4 font-semibold">{report.completedEnrollmentCount}</dd>
        </div>
      </dl>
      <div className="mt-5">
        <ProgressBar
          ariaLabel={teacherDashboardMessages.averageProgressFor(courseTitle)}
          label={teacherDashboardMessages.averageProgress}
          value={report.averageProgressPercentage}
        />
      </div>
      <ProgressActionLink
        className="mt-5 w-full"
        to={progressReportingPaths.teacherCourse(courseId)}
      >
        {teacherDashboardMessages.openReport}
      </ProgressActionLink>
    </>
  );
}

export function TeacherCourseOverviewCard({ course }: { course: AssignedTeacherCourse }) {
  const report = useTeacherCourseReporting(course.id, TEACHER_DASHBOARD_REPORT_QUERY);

  return (
    <Card className="flex h-full min-w-0 flex-col" padding="lg">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="type-heading-4 min-w-0 overflow-wrap-anywhere">{course.title}</h3>
        <Badge intent={statusIntent[course.status]}>
          {teacherDashboardMessages.status[course.status]}
        </Badge>
      </div>
      {course.level ? (
        <p className="mt-2 text-caption text-text-muted">
          {teacherDashboardMessages.level}: {course.level}
        </p>
      ) : null}
      <div className="mt-5 border-t border-border-decorative pt-5">
        <TeacherCourseReportView
          courseId={course.id}
          courseTitle={course.title}
          error={report.error}
          isPending={report.isPending}
          onRetry={() => void report.refetch()}
          report={report.data ?? null}
        />
      </div>
    </Card>
  );
}
