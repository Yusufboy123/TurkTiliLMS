import { apiClient } from '../../../lib/api-client';
import type {
  CertificateEligibility,
  CertificateReadScope,
  CertificateStatus,
  SuccessEnvelope,
} from '../types/certificate-eligibility.types';

function basePath(scope: CertificateReadScope, enrollmentId: string): string {
  return scope.kind === 'self'
    ? `/me/enrollments/${enrollmentId}`
    : `/courses/${scope.courseId}/enrollments/${enrollmentId}`;
}

export const certificateEligibilityApi = {
  async getEligibility(
    enrollmentId: string,
    scope: CertificateReadScope,
  ): Promise<CertificateEligibility> {
    const response = await apiClient.get<SuccessEnvelope<CertificateEligibility>>(
      `${basePath(scope, enrollmentId)}/certificate-eligibility`,
    );
    return response.data.data;
  },

  async getCertificateStatus(
    enrollmentId: string,
    scope: CertificateReadScope,
  ): Promise<CertificateStatus> {
    const response = await apiClient.get<SuccessEnvelope<CertificateStatus>>(
      `${basePath(scope, enrollmentId)}/certificate-status`,
    );
    return response.data.data;
  },

  async downloadCertificate(certificateId: string, scope: CertificateReadScope): Promise<Blob> {
    const path =
      scope.kind === 'self'
        ? `/me/certificates/${certificateId}/download`
        : `/courses/${scope.courseId}/certificates/${certificateId}/download`;
    const response = await apiClient.get<Blob>(path, { responseType: 'blob' });
    return response.data;
  },
};
