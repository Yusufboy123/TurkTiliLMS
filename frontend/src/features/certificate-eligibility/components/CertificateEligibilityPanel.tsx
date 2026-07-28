import { Badge, Button, Card } from '../../../components';
import { certificateEligibilityMessages as messages } from '../../../locales/uz-Latn/certificate-eligibility';
import { certificateEligibilityErrorMessage } from '../api/certificate-eligibility.error';
import {
  useCertificateEligibility,
  useCertificateStatus,
} from '../hooks/use-certificate-eligibility';
import type { CertificateReadScope } from '../types/certificate-eligibility.types';

interface CertificateEligibilityPanelProps {
  enrollmentId: string;
  scope: CertificateReadScope;
}

export function CertificateEligibilityPanel({
  enrollmentId,
  scope,
}: CertificateEligibilityPanelProps) {
  const eligibility = useCertificateEligibility(enrollmentId, scope);
  const certificateStatus = useCertificateStatus(enrollmentId, scope);

  if (eligibility.isError || certificateStatus.isError) {
    const error = eligibility.error ?? certificateStatus.error;
    return (
      <Card className="mt-8 border-danger-border bg-danger-bg" elevation="none" role="alert">
        <h2 className="type-heading-3 text-danger-text">{messages.errors.title}</h2>
        <p className="mt-2 text-body-sm text-danger-text">
          {certificateEligibilityErrorMessage(error)}
        </p>
        <Button
          className="mt-4"
          intent="secondary"
          onClick={() => {
            void eligibility.refetch();
            void certificateStatus.refetch();
          }}
        >
          {messages.retry}
        </Button>
      </Card>
    );
  }

  if (eligibility.isPending || certificateStatus.isPending) {
    return (
      <Card aria-busy="true" className="mt-8" elevation="none" role="status">
        <h2 className="type-heading-3">{messages.title}</h2>
        <p className="mt-3 text-body-sm text-text-secondary">{messages.loading}</p>
      </Card>
    );
  }

  if (!eligibility.data || !certificateStatus.data) return null;

  const isEligible = eligibility.data.eligibility.status === 'ELIGIBLE';
  const statusHint = isEligible
    ? messages.eligibleHint
    : eligibility.data.eligibility.status === 'NOT_ELIGIBLE'
      ? messages.notEligibleHint
      : messages.incompleteHint;

  return (
    <section aria-labelledby="certificate-eligibility-heading" className="mt-8">
      <Card elevation="none" padding="lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="type-heading-3" id="certificate-eligibility-heading">
              {messages.title}
            </h2>
            <p className="mt-2 text-body-sm text-text-secondary">
              {eligibility.data.completion.completedLessons}/
              {eligibility.data.completion.totalEligibleLessons} {messages.lessons}
            </p>
          </div>
          <Badge intent={isEligible ? 'success' : 'warning'}>
            {messages.eligibility[eligibility.data.eligibility.status]}
          </Badge>
        </div>

        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-label-md text-text-secondary">{messages.completion}</dt>
            <dd className="mt-1 text-body-md">{eligibility.data.completion.percentage}%</dd>
          </div>
          <div>
            <dt className="text-label-md text-text-secondary">{messages.title}</dt>
            <dd className="mt-1">
              <Badge intent="neutral">{messages.certificate[certificateStatus.data.status]}</Badge>
            </dd>
          </div>
        </dl>

        <p className="mt-5 text-body-sm text-text-secondary">{statusHint}</p>
      </Card>
    </section>
  );
}
