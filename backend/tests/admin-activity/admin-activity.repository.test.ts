import { describe, expect, it, vi } from 'vitest';
import { PrismaAdminActivityRepository } from '../../src/modules/admin-activity/admin-activity.repository.js';
import type { PrismaClient } from '@prisma/client';

describe('PrismaAdminActivityRepository safe projection', () => {
  it('does not return raw metadata or secret fields', async () => {
    const findMany = vi.fn().mockResolvedValue([{
      id: 'log-1',
      action: 'users.deleted',
      subjectType: 'user',
      subjectId: 'user-1',
      occurredAt: new Date('2026-08-11T00:00:00.000Z'),
      actor: { id: 'admin-1', email: 'admin@example.test', firstName: 'Admin', lastName: null, displayName: null },
      afterSummary: { displayName: 'Student', password: 'must-not-leak' },
      beforeSummary: null,
    }]);
    const client = {
      auditLog: { findMany, count: vi.fn().mockResolvedValue(1) },
      $transaction: vi.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    } as unknown as PrismaClient;
    const result = await new PrismaAdminActivityRepository(client).list({ page: 1, pageSize: 20 });
    expect(result.items[0]).toMatchObject({ summary: 'users.deleted — Student' });
    expect(JSON.stringify(result.items[0])).not.toContain('must-not-leak');
    expect(result.items[0]).not.toHaveProperty('metadata');
  });
});
