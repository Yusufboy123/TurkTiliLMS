import { CourseLevel, type PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaGroupRepository } from '../../src/modules/groups/groups.repository.js';

const group = {
  id: '019b9e22-e356-713e-be3a-ab43b5b43f8e',
  name: 'A1 guruhi',
  level: CourseLevel.A1,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  teacher: { id: 'teacher-1', email: 'teacher@example.test', displayName: 'Ali', firstName: 'Ali', lastName: null },
  _count: { memberships: 0 },
};

function transaction() {
  return {
    group: {
      create: vi.fn().mockResolvedValue(group),
      findUnique: vi.fn().mockResolvedValue(group),
      update: vi.fn().mockResolvedValue({ ...group, deletedAt: new Date() }),
    },
    groupStudent: {
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
}

describe('PrismaGroupRepository activity logging', () => {
  it('writes group lifecycle and membership logs only after the business mutation', async () => {
    const tx = transaction();
    const client = { $transaction: vi.fn((operation: (value: typeof tx) => unknown) => operation(tx)) } as unknown as PrismaClient;
    const repository = new PrismaGroupRepository(client);

    await repository.create({ name: group.name, level: group.level, teacherId: group.teacher.id, createdById: 'admin-1' }, { actorUserId: 'admin-1' });
    await repository.addStudent(group.id, 'student-1', { actorUserId: 'admin-1' });
    await repository.removeStudent(group.id, 'student-1', { actorUserId: 'admin-1' });
    await repository.softDelete(group.id, { actorUserId: 'admin-1' });
    tx.group.findUnique.mockResolvedValue({ ...group, deletedAt: new Date() });
    tx.group.update.mockResolvedValue({ ...group, deletedAt: null });
    await repository.restore(group.id, { actorUserId: 'admin-1' });

    expect(tx.auditLog.create).toHaveBeenCalledTimes(5);
    expect(tx.auditLog.create.mock.calls.map(([call]) => call.data.action)).toEqual([
      'groups.created',
      'groups.student_added',
      'groups.student_removed',
      'groups.deleted',
      'groups.restored',
    ]);
  });

  it('does not write a false success log when the mutation fails', async () => {
    const tx = transaction();
    tx.group.create.mockRejectedValue(new Error('database unavailable'));
    const client = { $transaction: vi.fn((operation: (value: typeof tx) => unknown) => operation(tx)) } as unknown as PrismaClient;
    const repository = new PrismaGroupRepository(client);

    await expect(repository.create({ name: group.name, level: group.level, teacherId: group.teacher.id, createdById: 'admin-1' }, { actorUserId: 'admin-1' })).rejects.toThrow('database unavailable');
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
