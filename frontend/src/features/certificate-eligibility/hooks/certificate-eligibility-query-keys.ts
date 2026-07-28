import type { CertificateReadScope } from '../types/certificate-eligibility.types';

function scopeKey(scope: CertificateReadScope) {
  return scope.kind === 'self' ? (['self'] as const) : (['course', scope.courseId] as const);
}

export const certificateEligibilityQueryKeys = {
  all: ['certificate-eligibility'] as const,
  enrollment: (scope: CertificateReadScope, enrollmentId: string) =>
    [
      ...certificateEligibilityQueryKeys.all,
      ...scopeKey(scope),
      'enrollment',
      enrollmentId,
    ] as const,
  eligibility: (scope: CertificateReadScope, enrollmentId: string) =>
    [...certificateEligibilityQueryKeys.enrollment(scope, enrollmentId), 'eligibility'] as const,
  certificateStatus: (scope: CertificateReadScope, enrollmentId: string) =>
    [
      ...certificateEligibilityQueryKeys.enrollment(scope, enrollmentId),
      'certificate-status',
    ] as const,
};
