import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminUsersApi } from '../api/admin-users.api';
import { adminUsersQueryKeys } from './admin-users-query-keys';
import type { RoleCode, UserStatus } from '../../auth/types/auth.types';
import type { CertificateEligibility } from '../types/admin-users.types';

export function useAdminUsers(query: { page: number; pageSize: number; search?: string; role?: RoleCode; status?: UserStatus }) {
  return useQuery({ queryKey: adminUsersQueryKeys.list(query), queryFn: () => adminUsersApi.list(query), staleTime: 10_000 });
}

export function useAdminUser(userId: string) {
  return useQuery({ queryKey: adminUsersQueryKeys.detail(userId), queryFn: () => adminUsersApi.get(userId), enabled: Boolean(userId) });
}

export function useAdminStudent(userId: string, enabled: boolean) {
  return useQuery({ queryKey: adminUsersQueryKeys.student(userId), queryFn: () => adminUsersApi.student(userId), enabled: Boolean(userId) && enabled });
}

export function useAdminCourses(teacherId?: string) {
  return useQuery({ queryKey: adminUsersQueryKeys.courses(teacherId), queryFn: () => adminUsersApi.courses(teacherId), staleTime: 15_000 });
}

export function useAdminRoles(userId: string) {
  const client = useQueryClient();
  return useMutation({ mutationFn: (roles: RoleCode[]) => adminUsersApi.replaceRoles(userId, roles), onSuccess: (user) => { client.setQueryData(adminUsersQueryKeys.detail(userId), user); void client.invalidateQueries({ queryKey: adminUsersQueryKeys.root }); } });
}

export function useAdminUserStatus(userId: string) {
  const client = useQueryClient();
  return useMutation({ mutationFn: (status: Exclude<UserStatus, 'DELETED'>) => adminUsersApi.updateStatus(userId, status), onSuccess: (user) => { client.setQueryData(adminUsersQueryKeys.detail(userId), user); void client.invalidateQueries({ queryKey: adminUsersQueryKeys.root }); } });
}

export function useAdminUserDelete() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => adminUsersApi.delete(userId),
    onSuccess: (_data, userId) => {
      void client.invalidateQueries({ queryKey: adminUsersQueryKeys.detail(userId) });
      void client.invalidateQueries({ queryKey: adminUsersQueryKeys.root });
    },
  });
}

export function useAdminUserRestore() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => adminUsersApi.restore(userId),
    onSuccess: (user, userId) => {
      client.setQueryData(adminUsersQueryKeys.detail(userId), user);
      void client.invalidateQueries({ queryKey: adminUsersQueryKeys.root });
    },
  });
}

export function useAssignAdminCourseTeacher() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (input: { courseId: string; teacherId: string | null }) => adminUsersApi.assignTeacher(input.courseId, input.teacherId), onSuccess: () => { void client.invalidateQueries({ queryKey: adminUsersQueryKeys.courses() }); void client.invalidateQueries({ queryKey: adminUsersQueryKeys.root }); } });
}

export function useAdminEnrollStudent() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (input: { courseId: string; studentId: string }) => adminUsersApi.enroll(input.courseId, input.studentId), onSuccess: (_data, input) => { void client.invalidateQueries({ queryKey: adminUsersQueryKeys.student(input.studentId) }); } });
}

export function useAdminEnrollmentStatus() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (input: { enrollmentId: string; studentId: string; status: string }) => adminUsersApi.updateEnrollmentStatus(input.enrollmentId, input.status), onSuccess: (_data, input) => { void client.invalidateQueries({ queryKey: adminUsersQueryKeys.student(input.studentId) }); } });
}

export function useAdminEnrollmentAccess() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { enrollmentId: string; studentId: string; durationMonths?: number; accessExpiresAt?: string }) =>
      adminUsersApi.updateEnrollmentAccess(input.enrollmentId, { ...(input.durationMonths ? { durationMonths: input.durationMonths } : {}), ...(input.accessExpiresAt ? { accessExpiresAt: input.accessExpiresAt } : {}) }),
    onSuccess: (_data, input) => { void client.invalidateQueries({ queryKey: adminUsersQueryKeys.student(input.studentId) }); },
  });
}

export function useAdminCertificateEligibility(courseId: string, enrollmentId: string) {
  return useQuery({ queryKey: adminUsersQueryKeys.eligibility(courseId, enrollmentId), queryFn: () => adminUsersApi.eligibility(courseId, enrollmentId), enabled: Boolean(courseId && enrollmentId) });
}

export function useAdminCertificateStatus(courseId: string, enrollmentId: string) {
  return useQuery({ queryKey: adminUsersQueryKeys.certificate(courseId, enrollmentId), queryFn: () => adminUsersApi.certificateStatus(courseId, enrollmentId), enabled: Boolean(courseId && enrollmentId) });
}

export function useIssueAdminCertificate() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (input: { enrollmentId: string; eligibility: CertificateEligibility; password: string; courseId: string; studentId: string }) => adminUsersApi.issueCertificate(input), onSuccess: (_data, input) => { void client.invalidateQueries({ queryKey: adminUsersQueryKeys.certificate(input.courseId, input.enrollmentId) }); void client.invalidateQueries({ queryKey: adminUsersQueryKeys.student(input.studentId) }); } });
}

export function useRevokeAdminCertificate() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (input: { certificateId: string; version: number; password: string; reasonCode: string; reasonNote?: string; courseId: string; enrollmentId: string; studentId: string }) => adminUsersApi.revokeCertificate(input), onSuccess: (_data, input) => { void client.invalidateQueries({ queryKey: adminUsersQueryKeys.certificate(input.courseId, input.enrollmentId) }); void client.invalidateQueries({ queryKey: adminUsersQueryKeys.student(input.studentId) }); } });
}
