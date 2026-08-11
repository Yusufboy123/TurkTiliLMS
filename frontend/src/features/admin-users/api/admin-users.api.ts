import { apiClient } from '../../../lib/api-client';
import type { SuccessEnvelope, RoleCode, UserStatus } from '../../auth/types/auth.types';
import type {
  AdminCoursePage,
  AdminEnrollmentPage,
  AdminStudentDetail,
  AdminUser,
  AdminUserDetail,
  AdminUserPage,
  CertificateEligibility,
  CertificateStatus,
} from '../types/admin-users.types';

function idempotencyKey(): string {
  return crypto.randomUUID();
}

export const adminUsersApi = {
  async list(params: { page: number; pageSize: number; search?: string; role?: RoleCode; status?: UserStatus }): Promise<AdminUserPage> {
    const response = await apiClient.get<SuccessEnvelope<AdminUserPage>>('/users', {
      params: { ...params, deleted: 'exclude', sortBy: 'createdAt', sortDirection: 'desc' },
    });
    return response.data.data;
  },
  async get(userId: string): Promise<AdminUserDetail> {
    const response = await apiClient.get<SuccessEnvelope<AdminUserDetail>>(`/users/${userId}`);
    return response.data.data;
  },
  async replaceRoles(userId: string, roles: RoleCode[]): Promise<AdminUser> {
    const response = await apiClient.put<SuccessEnvelope<AdminUser>>(`/users/${userId}/roles`, { roles });
    return response.data.data;
  },
  async updateStatus(userId: string, status: Exclude<UserStatus, 'DELETED'>): Promise<AdminUser> {
    const response = await apiClient.patch<SuccessEnvelope<AdminUser>>(`/users/${userId}/status`, { status });
    return response.data.data;
  },
  async courses(teacherId?: string): Promise<AdminCoursePage> {
    const response = await apiClient.get<SuccessEnvelope<AdminCoursePage>>('/courses', {
      params: { page: 1, pageSize: 100, deleted: 'exclude', sortBy: 'createdAt', sortDirection: 'desc', ...(teacherId ? { teacherId } : {}) },
    });
    return response.data.data;
  },
  async assignTeacher(courseId: string, teacherId: string | null): Promise<unknown> {
    const response = await apiClient.patch<SuccessEnvelope<unknown>>(`/courses/${courseId}/teacher`, { teacherId });
    return response.data.data;
  },
  async student(studentId: string): Promise<AdminStudentDetail> {
    const response = await apiClient.get<SuccessEnvelope<AdminStudentDetail>>(`/students/${studentId}`);
    return response.data.data;
  },
  async enrollments(courseId: string, studentId: string): Promise<AdminEnrollmentPage> {
    const response = await apiClient.get<SuccessEnvelope<AdminEnrollmentPage>>(`/courses/${courseId}/enrollments`, {
      params: { page: 1, pageSize: 100, studentId },
    });
    return response.data.data;
  },
  async enroll(courseId: string, studentId: string): Promise<unknown> {
    const response = await apiClient.post<SuccessEnvelope<unknown>>(`/courses/${courseId}/enrollments`, { studentId });
    return response.data.data;
  },
  async updateEnrollmentStatus(enrollmentId: string, status: string): Promise<unknown> {
    const response = await apiClient.patch<SuccessEnvelope<unknown>>(`/enrollments/${enrollmentId}/status`, { status });
    return response.data.data;
  },
  async eligibility(courseId: string, enrollmentId: string): Promise<CertificateEligibility> {
    const response = await apiClient.get<SuccessEnvelope<CertificateEligibility>>(`/courses/${courseId}/enrollments/${enrollmentId}/certificate-eligibility`);
    return response.data.data;
  },
  async certificateStatus(courseId: string, enrollmentId: string): Promise<CertificateStatus> {
    const response = await apiClient.get<SuccessEnvelope<CertificateStatus>>(`/courses/${courseId}/enrollments/${enrollmentId}/certificate-status`);
    return response.data.data;
  },
  async stepUpChallenge(action: 'CERTIFICATE_ISSUE' | 'CERTIFICATE_REVOKE', targetType: 'ENROLLMENT' | 'CERTIFICATE', targetId: string): Promise<{ id: string }> {
    const response = await apiClient.post<SuccessEnvelope<{ id: string }>>('/auth/step-up/challenges', {
      action,
      targetType,
      targetId,
      continuation: action === 'CERTIFICATE_ISSUE' ? 'CERTIFICATE_ISSUE_CONFIRMATION' : 'CERTIFICATE_REVOKE_CONFIRMATION',
    });
    return response.data.data;
  },
  async verifyStepUp(challengeId: string, password: string): Promise<{ proof: string }> {
    const response = await apiClient.post<SuccessEnvelope<{ proof: string }>>(`/auth/step-up/challenges/${challengeId}/verify`, { password });
    return response.data.data;
  },
  async issueCertificate(input: { enrollmentId: string; eligibility: CertificateEligibility; password: string }): Promise<unknown> {
    const challenge = await adminUsersApi.stepUpChallenge('CERTIFICATE_ISSUE', 'ENROLLMENT', input.enrollmentId);
    const proof = await adminUsersApi.verifyStepUp(challenge.id, input.password);
    const response = await apiClient.post<SuccessEnvelope<unknown>>(`/enrollments/${input.enrollmentId}/certificates`, {
      eligibilityEvaluationId: input.eligibility.eligibility.id,
      eligibilityEvaluationVersion: input.eligibility.eligibility.evaluationVersion,
      completionVersion: input.eligibility.completion.completionVersion,
      curriculumVersion: input.eligibility.completion.completionCurriculumVersion,
      confirmed: true,
    }, { headers: { 'Idempotency-Key': idempotencyKey(), 'X-Step-Up-Proof': proof.proof } });
    return response.data.data;
  },
  async revokeCertificate(input: { certificateId: string; version: number; password: string; reasonCode: string; reasonNote?: string }): Promise<unknown> {
    const challenge = await adminUsersApi.stepUpChallenge('CERTIFICATE_REVOKE', 'CERTIFICATE', input.certificateId);
    const proof = await adminUsersApi.verifyStepUp(challenge.id, input.password);
    const response = await apiClient.post<SuccessEnvelope<unknown>>(`/certificates/${input.certificateId}/revoke`, {
      expectedVersion: input.version,
      reasonCode: input.reasonCode,
      ...(input.reasonNote ? { reasonNote: input.reasonNote } : {}),
      confirmed: true,
    }, { headers: { 'Idempotency-Key': idempotencyKey(), 'X-Step-Up-Proof': proof.proof } });
    return response.data.data;
  },
};
