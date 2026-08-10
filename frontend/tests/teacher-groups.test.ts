import { describe, expect, it, vi } from 'vitest';
import { teacherGroupsApi } from '../src/features/teacher-groups/api/teacher-groups.api';
import { teacherGroupPaths } from '../src/features/teacher-groups/teacher-groups.routes';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), del: vi.fn() }));
vi.mock('../src/lib/api-client', () => ({
  apiClient: { get: mocks.get, post: mocks.post, delete: mocks.del },
}));

describe('teacher group contracts', () => {
  it('defines stable teacher group routes', () => {
    expect(teacherGroupPaths.list).toBe('/teacher/groups');
    expect(teacherGroupPaths.detail('group-1')).toBe('/teacher/groups/group-1');
  });

  it('uses bounded group and student endpoints', async () => {
    mocks.get.mockResolvedValueOnce({
      data: {
        data: { items: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } },
      },
    });
    mocks.get.mockResolvedValueOnce({ data: { data: [] } });
    await teacherGroupsApi.list({ page: 1, pageSize: 20 });
    await teacherGroupsApi.searchStudents('group-1', 'Ali');
    expect(mocks.get).toHaveBeenNthCalledWith(1, '/groups', { params: { page: 1, pageSize: 20 } });
    expect(mocks.get).toHaveBeenNthCalledWith(2, '/groups/group-1/students/search', {
      params: { search: 'Ali' },
    });
  });
});
