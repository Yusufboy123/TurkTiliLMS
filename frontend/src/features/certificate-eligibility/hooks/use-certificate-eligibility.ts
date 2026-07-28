import { useQuery } from '@tanstack/react-query';
import { certificateEligibilityApi } from '../api/certificate-eligibility.api';
import type { CertificateReadScope } from '../types/certificate-eligibility.types';
import { certificateEligibilityQueryKeys } from './certificate-eligibility-query-keys';

export function useCertificateEligibility(enrollmentId: string, scope: CertificateReadScope) {
  return useQuery({
    queryKey: certificateEligibilityQueryKeys.eligibility(scope, enrollmentId),
    queryFn: () => certificateEligibilityApi.getEligibility(enrollmentId, scope),
    enabled: Boolean(enrollmentId && (scope.kind === 'self' || scope.courseId)),
  });
}

export function useCertificateStatus(enrollmentId: string, scope: CertificateReadScope) {
  return useQuery({
    queryKey: certificateEligibilityQueryKeys.certificateStatus(scope, enrollmentId),
    queryFn: () => certificateEligibilityApi.getCertificateStatus(enrollmentId, scope),
    enabled: Boolean(enrollmentId && (scope.kind === 'self' || scope.courseId)),
  });
}
