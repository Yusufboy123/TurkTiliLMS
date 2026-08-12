import { RoleCode } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { AdminActivityService } from '../../src/modules/admin-activity/admin-activity.service.js';
import type { AdminActivityRepository } from '../../src/modules/admin-activity/admin-activity.repository.js';
import type { AdminActivityRecord } from '../../src/modules/admin-activity/admin-activity.types.js';

const admin = { userId: 'admin-1', roles: [RoleCode.ADMIN], permissions: ['audit.read'] } as const;
const query = { page: 1, pageSize: 20 } as const;
const record: AdminActivityRecord = {
  id: 'log-1',
  actor: { id: 'admin-1', name: 'Admin', email: 'admin@example.test' },
  action: 'users.deleted',
  entityType: 'user',
  entityId: 'user-1',
  summary: 'users.deleted — Student',
  createdAt: '2026-08-11T00:00:00.000Z',
};

class FakeActivityRepository implements AdminActivityRepository {
  async list() {
    return { items: [record], total: 1 };
  }
}

describe('AdminActivityService', () => {
  it('lists newest activity for an authorized administrator', async () => {
    const result = await new AdminActivityService(new FakeActivityRepository()).list(admin, query);
    expect(result.items).toEqual([record]);
    expect(result.pagination).toMatchObject({ page: 1, totalItems: 1, totalPages: 1 });
  });

  it('denies teachers and students', async () => {
    const service = new AdminActivityService(new FakeActivityRepository());
    await expect(service.list({ userId: 'teacher-1', roles: [RoleCode.TEACHER], permissions: ['audit.read'] }, query)).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.list({ userId: 'student-1', roles: [RoleCode.STUDENT], permissions: [] }, query)).rejects.toMatchObject({ statusCode: 403 });
  });
});
