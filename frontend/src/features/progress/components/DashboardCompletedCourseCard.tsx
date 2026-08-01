import { Badge, Button, Card, Skeleton, type BadgeIntent } from '../../../components';
import { certificateEligibilityMessages as certificateMessages } from '../../../locales/uz-Latn/certificate-eligibility';
import { progressMessages } from '../../../locales/uz-Latn/progress';
import { CertificateDownloadButton } from '../../certificate-eligibility';
import { certificateEligibilityErrorMessage } from '../../certificate-eligibility/api/certificate-eligibility.error';
import { useCertificateStatus } from '../../certificate-eligibility/hooks/use-certificate-eligibility';
import type { CertificateStatus } from '../../certificate-eligibility/types/certificate-eligibility.types';
import type { CompletedCourse } from '../types/progress.types';
import { formatProgressDate } from '../utils/progress-format';
import { ProgressRing } from './ProgressRing';

const certificateIntent: Record<CertificateStatus['status'], BadgeIntent> = {
  NOT_ISSUED: 'neutral',
  ISSUED: 'success',
  REVOKED: 'danger',
};

interface DashboardCertificateStatusViewProps {
  error: unknown;
  isPending: boolean;
  onRetry: () => void;
  status: CertificateStatus | null;
}

export function DashboardCertificateStatusView({
  error,
  isPending,
  onRetry,
  status,
}: DashboardCertificateStatusViewProps) {
  const scope = { kind: 'self' as const };

  if (isPending) {
    return (
      <div aria-label={certificateMessages.loading} className="space-y-3" role="status">
        <Skeleton className="h-6 w-2/5" shape="text" />
        <Skeleton className="h-4 w-3/5" shape="text" />
      </div>
    );
  }

  if (error && !status) {
    return (
      <div role="alert">
        <p className="text-body-sm text-danger-text">{certificateEligibilityErrorMessage(error)}</p>
        <Button className="mt-3" intent="secondary" onClick={onRetry} size="sm">
          {certificateMessages.retry}
        </Button>
      </div>
    );
  }

  if (!status) return null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-label-sm text-text-secondary">
          {progressMessages.dashboard.certificateStatus}
        </p>
        <Badge intent={certificateIntent[status.status]}>
          {certificateMessages.certificate[status.status]}
        </Badge>
      </div>
      {status.certificate ? (
        <p className="mt-3 text-body-sm text-text-secondary">
          {certificateMessages.certificateNumber}:{' '}
          <span className="font-semibold text-text-primary">
            {status.certificate.certificateNumber}
          </span>
        </p>
      ) : null}
      {status.certificate?.canDownload ? (
        <CertificateDownloadButton certificate={status.certificate} scope={scope} />
      ) : null}
    </>
  );
}

export function DashboardCompletedCourseCard({ course }: { course: CompletedCourse }) {
  const scope = { kind: 'self' as const };
  const certificateStatus = useCertificateStatus(course.enrollmentId, scope);

  return (
    <Card className="flex h-full flex-col" padding="lg">
      <div className="flex items-start gap-4">
        <ProgressRing label={course.course.title} size="sm" value={course.percentage} />
        <div className="min-w-0">
          <h3 className="type-heading-4 overflow-wrap-anywhere">{course.course.title}</h3>
          <p className="mt-2 text-body-sm text-text-secondary">
            {course.completedLessons}/{course.totalEligibleLessons}{' '}
            {progressMessages.progress.lessons}
          </p>
          <p className="mt-1 text-caption text-text-muted">
            {progressMessages.completed.finishedAt}: {formatProgressDate(course.completedAt)}
          </p>
        </div>
      </div>

      <section
        aria-label={progressMessages.dashboard.certificateStatus}
        className="mt-5 border-t border-border-decorative pt-5"
      >
        <DashboardCertificateStatusView
          error={certificateStatus.error}
          isPending={certificateStatus.isPending}
          onRetry={() => void certificateStatus.refetch()}
          status={certificateStatus.data ?? null}
        />
      </section>
    </Card>
  );
}
