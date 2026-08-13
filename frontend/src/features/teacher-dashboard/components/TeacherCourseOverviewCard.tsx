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

const statusLabel: Record<TeacherCourseStatus, string> = {
  DRAFT: 'Qoralama',
  IN_REVIEW: "Ko'rib chiqilmoqda",
  PUBLISHED: 'Nashr etilgan',
  ARCHIVED: 'Arxivlangan',
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
        <p className="text-sm text-danger-text">{teacherDashboardMessages.courseSummaryError}</p>
        <Button className="mt-3" intent="secondary" onClick={onRetry} size="sm">
          {teacherDashboardMessages.retry}
        </Button>
      </div>
    );
  }

  if (!report) return null;

  return (
    <>
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-subtle px-2 py-3">
          <dt className="text-xs font-medium text-text-muted">Jami</dt>
          <dd className="mt-0.5 text-xl font-extrabold tabular-nums">{report.pagination.totalItems}</dd>
        </div>
        <div className="rounded-lg bg-subtle px-2 py-3">
          <dt className="text-xs font-medium text-text-muted">Faol</dt>
          <dd className="mt-0.5 text-xl font-extrabold tabular-nums">{report.activeEnrollmentCount}</dd>
        </div>
        <div className="rounded-lg bg-subtle px-2 py-3">
          <dt className="text-xs font-medium text-text-muted">Yakunlagan</dt>
          <dd className="mt-0.5 text-xl font-extrabold tabular-nums">{report.completedEnrollmentCount}</dd>
        </div>
      </dl>
      <div className="mt-4">
        <ProgressBar
          ariaLabel={teacherDashboardMessages.averageProgressFor(courseTitle)}
          label={teacherDashboardMessages.averageProgress}
          value={report.averageProgressPercentage}
        />
      </div>
      <ProgressActionLink
        className="mt-4 w-full"
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
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="type-heading-4 min-w-0 flex-1 overflow-wrap-anywhere leading-snug">
          {course.title}
        </h3>
        <Badge intent={statusIntent[course.status]}>
          {statusLabel[course.status] ?? teacherDashboardMessages.status[course.status]}
        </Badge>
      </div>

      {course.level ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-text-muted">
          <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-action-primary-bg" />
          {teacherDashboardMessages.level}: {course.level}
        </p>
      ) : null}

      <div className="mt-4 flex-1 border-t border-border-decorative pt-4">
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
