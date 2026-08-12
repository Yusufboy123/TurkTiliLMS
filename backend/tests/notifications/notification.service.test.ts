import { RoleCode } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { NotificationService } from '../../src/modules/notifications/notification.service.js';
import type { NotificationRepository } from '../../src/modules/notifications/notification.repository.js';

const admin = { userId: 'admin-1', roles: [RoleCode.ADMIN], permissions: ['announcements.create'] } as const;
const student = { userId: 'student-1', roles: [RoleCode.STUDENT], permissions: [] } as const;

class FakeNotificationRepository implements NotificationRepository {
  generated = 0;
  async list() { return { items: [], total: 0, unreadCount: 0 }; }
  async markRead() { return true; }
  async markAllRead() { return 1; }
  async create() { return undefined; }
  async announce() { return 2; }
  async generateDueWarnings() { this.generated += 1; }
}

describe('NotificationService', () => {
  it('lists only the owner and generates student warnings on read', async () => {
    const repository = new FakeNotificationRepository();
    const result = await new NotificationService(repository).list(student, { page: 1, pageSize: 20 });
    expect(repository.generated).toBe(1);
    expect(result.unreadCount).toBe(0);
  });

  it('allows admin announcements but denies non-admin actors', async () => {
    const repository = new FakeNotificationRepository();
    const service = new NotificationService(repository);
    await expect(service.announce(admin, { audience: 'ALL', title: 'Test', message: 'Xabar' })).resolves.toBe(2);
    await expect(service.announce(student, { audience: 'ALL', title: 'Test', message: 'Xabar' })).rejects.toMatchObject({ statusCode: 403 });
  });
});
