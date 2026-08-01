export interface CertificateCapabilities {
  canReadEligibility: boolean;
  canReadCertificateStatus: boolean;
  canIssueCertificate: false;
  canRevokeCertificate: false;
}

export interface CertificateEligibility {
  enrollmentId: string;
  course: { id: string; title: string; slug: string };
  completion: {
    status: 'NOT_COMPLETED' | 'COMPLETED';
    completedAt: string | null;
    completionCurriculumVersion: number | null;
    completionVersion: number | null;
    completedLessons: number;
    totalEligibleLessons: number;
    percentage: number;
  };
  eligibility: {
    id: string | null;
    status: 'NOT_COMPLETED' | 'NOT_ELIGIBLE' | 'ELIGIBLE';
    policyCode: 'COURSE_COMPLETION_ONLY' | null;
    policyVersion: number | null;
    evaluationVersion: number | null;
    evaluatedAt: string | null;
    reasonCodes: string[];
  };
  capabilities: CertificateCapabilities;
}

export interface CertificateStatus {
  enrollmentId: string;
  course: { id: string; title: string; slug: string };
  status: 'NOT_ISSUED' | 'ISSUED' | 'REVOKED';
  certificate: CertificateReference | null;
  capabilities: CertificateCapabilities;
}

export interface CertificateReference {
  id: string;
  certificateId: string;
  certificateNumber: string;
  status: 'ISSUED' | 'REVOKED';
  issuedAt: string;
  revokedAt: string | null;
  safeRevocationReasonCode:
    'FRAUD' | 'ADMINISTRATIVE_ERROR' | 'DUPLICATE_ISSUANCE' | 'POLICY_VIOLATION' | 'OTHER' | null;
  version: number;
  canDownload: boolean;
}

export interface SuccessEnvelope<T> {
  success: true;
  message: string;
  data: T;
}

export type CertificateReadScope = { kind: 'self' } | { kind: 'course'; courseId: string };
