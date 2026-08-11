import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminUsersApi } from '../src/features/admin-users/api/admin-users.api';
import { adminUsersQueryKeys } from '../src/features/admin-users/hooks/admin-users-query-keys';
import AdminUsersPage from '../src/features/admin-users/pages/AdminUsersPage';
import { adminUsersPaths } from '../src/features/admin-users/admin-users.routes';
import type { AuthContextValue } from '../src/features/auth/auth-context';
import { AuthContext } from '../src/features/auth/auth-context';
import { RequireAuthorization } from '../src/features/auth/RequireAuthorization';
import { apiClient } from '../src/lib/api-client';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn() }));
vi.mock('../src/lib/api-client', () => ({ apiClient: mocks }));

const admin: AuthContextValue = {
  status: 'authenticated',
  reason: null,
  user: { id: 'admin-1', email: 'admin@example.test', firstName: 'Admin', lastName: null, status: 'ACTIVE', lastLoginAt: null },
  roles: ['ADMIN'],
  permissions: ['users.read', 'roles.assign', 'courses.assign_teacher', 'enrollments.create', 'enrollments.update_status', 'certificates.issue', 'certificates.revoke'],
  login: async () => undefined,
  logout: async () => undefined,
  logoutAll: async () => undefined,
};

describe('Admin MVP user management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the existing user list, role and status endpoints', async () => {
    mocks.get.mockResolvedValueOnce({ data: { data: { items: [], pagination: { page: 1, pageSize: 100, totalItems: 0, totalPages: 0 } } } });
    mocks.put.mockResolvedValueOnce({ data: { data: { id: 'student-1' } } });
    mocks.patch.mockResolvedValueOnce({ data: { data: { id: 'student-1' } } });

    await adminUsersApi.list({ page: 1, pageSize: 100, role: 'STUDENT' });
    await adminUsersApi.replaceRoles('student-1', ['TEACHER']);
    await adminUsersApi.updateStatus('student-1', 'SUSPENDED');

    expect(mocks.get).toHaveBeenCalledWith('/users', { params: expect.objectContaining({ role: 'STUDENT', deleted: 'exclude' }) });
    expect(mocks.put).toHaveBeenCalledWith('/users/student-1/roles', { roles: ['TEACHER'] });
    expect(mocks.patch).toHaveBeenCalledWith('/users/student-1/status', { status: 'SUSPENDED' });
  });

  it('renders a responsive users page with search, role/status filters and detail links', () => {
    const client = new QueryClient();
    const page = { items: [{ id: 'student-1', email: 'student@example.test', firstName: 'Ali', lastName: 'Talaba', displayName: null, status: 'ACTIVE' as const, emailVerifiedAt: null, lastLoginAt: null, deletedAt: null, createdAt: '2026-08-10T00:00:00.000Z', updatedAt: '2026-08-10T00:00:00.000Z', hasPassword: true, roles: ['STUDENT' as const] }], pagination: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 } };
    client.setQueryData(adminUsersQueryKeys.list({ page: 1, pageSize: 100 }), page);
    const markup = renderToStaticMarkup(<AuthContext.Provider value={admin}><QueryClientProvider client={client}><MemoryRouter><AdminUsersPage /></MemoryRouter></QueryClientProvider></AuthContext.Provider>);
    expect(markup).toContain('Foydalanuvchilar');
    expect(markup).toContain('Ali Talaba');
    expect(markup).toContain('Ism yoki email');
    expect(markup).toContain('Batafsil');
    expect(markup).toContain('md:hidden');
  });

  it('keeps the certificate API on the existing step-up protected contract', async () => {
    mocks.post
      .mockResolvedValueOnce({ data: { data: { id: 'challenge-1' } } })
      .mockResolvedValueOnce({ data: { data: { proof: 'proof' } } })
      .mockResolvedValueOnce({ data: { data: { certificateId: 'certificate-1' } } });
    await adminUsersApi.stepUpChallenge('CERTIFICATE_ISSUE', 'ENROLLMENT', 'enrollment-1');
    await adminUsersApi.verifyStepUp('challenge-1', 'password');
    expect(mocks.post).toHaveBeenNthCalledWith(1, '/auth/step-up/challenges', expect.objectContaining({ action: 'CERTIFICATE_ISSUE', targetType: 'ENROLLMENT' }));
    expect(apiClient).toBeDefined();
  });

  it('reuses managed enrollment creation and denies the users route to students', async () => {
    mocks.post.mockResolvedValueOnce({ data: { data: { id: 'enrollment-1' } } });
    await adminUsersApi.enroll('course-1', 'student-1');
    expect(mocks.post).toHaveBeenCalledWith('/courses/course-1/enrollments', { studentId: 'student-1' });

    const student: AuthContextValue = { ...admin, user: { ...admin.user, id: 'student-1' }, roles: ['STUDENT'], permissions: ['users.read'] };
    const markup = renderToStaticMarkup(<AuthContext.Provider value={student}><MemoryRouter initialEntries={[adminUsersPaths.list]}><Routes><Route element={<RequireAuthorization permissions={['users.read', 'roles.assign']} roles={['ADMIN']} />}><Route path={adminUsersPaths.list} element={<div>admin users</div>} /></Route></Routes></MemoryRouter></AuthContext.Provider>);
    expect(markup).not.toContain('admin users');
    expect(markup).toContain('Ruxsat mavjud emas');
  });
});
