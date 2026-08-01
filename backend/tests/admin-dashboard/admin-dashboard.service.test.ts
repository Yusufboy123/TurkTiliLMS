import { RoleCode } from '@prisma/client';
import { vi } from 'vitest';
import { AdminDashboardInvariantError } from '../../src/modules/admin-dashboard/admin-dashboard.errors.js';
import type {
  AdminDashboardRepository,
  AdminDashboardTransactionRepository,
} from '../../src/modules/admin-dashboard/admin-dashboard.repository.js';
import { AdminDashboardService } from '../../src/modules/admin-dashboard/admin-dashboard.service.js';
import type {
  AdminDashboardActor,
  AdminDashboardAggregateRow,
  AdminDashboardAuditContext,
} from '../../src/modules/admin-dashboard/admin-dashboard.types.js';

const ADMIN_ID = '019d0000-0000-7000-8000-000000000901';
const NOW = new Date('2026-08-01T10:00:00.000Z');
const requiredPermissions = [
  'users.read',
  'courses.view_statistics',
  'progress.read',
  'certificates.course_read',
];

function aggregate(
  overrides: Partial<AdminDashboardAggregateRow> = {},
): AdminDashboardAggregateRow {
  return {
    generatedAt: NOW,
    usersTotal: 12n,
    usersActive: 8n,
    usersSuspended: 1n,
    usersDeactivated: 2n,
    usersDeleted: 1n,
    usersLifecycleMismatch: 0n,
    usersStudents: 8n,
    usersTeachers: 3n,
    usersAdministrators: 1n,
    coursesTotal: 8n,
    coursesDraft: 2n,
    coursesInReview: 1n,
    coursesPublished: 3n,
    coursesArchived: 1n,
    coursesDeleted: 1n,
    enrollmentsTotal: 20n,
    enrollmentsActive: 11n,
    enrollmentsSuspended: 2n,
    enrollmentsCompleted: 5n,
    enrollmentsCancelled: 2n,
    progressTrackedEnrollments: 16n,
    invalidProgressCount: 0n,
    progressAverageCompletionPercentage: 62n,
    certificatesTotal: 5n,
    certificatesIssued: 4n,
    certificatesRevoked: 1n,
    ...overrides,
  };
}

class FakeAdminDashboardRepository implements AdminDashboardRepository {
  aggregate = aggregate();
  auditFailure: Error | null = null;
  readonly events: string[] = [];
  readonly consumeRateLimitSlot = vi.fn(async () => ({
    allowed: true,
    limit: 30,
    remaining: 29,
    resetAfterSeconds: 60,
  }));

  async withRepeatableReadTransaction<T>(
    operation: (transaction: AdminDashboardTransactionRepository) => Promise<T>,
  ): Promise<T> {
    this.events.push('transaction.started');
    try {
      const result = await operation({
        readAggregate: async () => {
          this.events.push('aggregate.read');
          return this.aggregate;
        },
        recordSummaryRead: async () => {
          this.events.push('audit.inserted');
          if (this.auditFailure) throw this.auditFailure;
        },
      });
      this.events.push('transaction.committed');
      return result;
    } catch (error: unknown) {
      this.events.push('transaction.rolled_back');
      throw error;
    }
  }
}

function actor(
  roles: RoleCode[] = [RoleCode.ADMIN],
  permissions: string[] = requiredPermissions,
): AdminDashboardActor {
  return { userId: ADMIN_ID, roles, permissions };
}

const audit: AdminDashboardAuditContext = {
  actorUserId: ADMIN_ID,
  ipHash: 'a'.repeat(64),
};

const unauthorizedActors: ReadonlyArray<readonly [string, AdminDashboardActor]> = [
  ['missing ADMIN role', actor([RoleCode.TEACHER])],
  ...requiredPermissions.map((permission): readonly [string, AdminDashboardActor] => [
    `missing ${permission}`,
    actor(
      [RoleCode.ADMIN],
      requiredPermissions.filter((candidate) => candidate !== permission),
    ),
  ]),
];

describe('Admin Dashboard service', () => {
  it('returns the exact approved DTO and audits before committing', async () => {
    const repository = new FakeAdminDashboardRepository();
    const service = new AdminDashboardService(repository);

    await expect(service.getSummary(actor(), audit)).resolves.toEqual({
      generatedAt: NOW.toISOString(),
      users: {
        total: 12,
        active: 8,
        suspended: 1,
        deactivated: 2,
        deleted: 1,
        students: 8,
        teachers: 3,
        administrators: 1,
      },
      courses: {
        total: 8,
        draft: 2,
        inReview: 1,
        published: 3,
        archived: 1,
        deleted: 1,
      },
      enrollments: {
        total: 20,
        active: 11,
        suspended: 2,
        completed: 5,
        cancelled: 2,
      },
      progress: { trackedEnrollments: 16, averageCompletionPercentage: 62 },
      certificates: { total: 5, issued: 4, revoked: 1 },
    });
    expect(repository.events).toEqual([
      'transaction.started',
      'aggregate.read',
      'audit.inserted',
      'transaction.committed',
    ]);
  });

  it('returns valid zero values without treating them as an empty error', async () => {
    const repository = new FakeAdminDashboardRepository();
    repository.aggregate = aggregate({
      usersTotal: 0n,
      usersActive: 0n,
      usersSuspended: 0n,
      usersDeactivated: 0n,
      usersDeleted: 0n,
      usersStudents: 0n,
      usersTeachers: 0n,
      usersAdministrators: 0n,
      coursesTotal: 0n,
      coursesDraft: 0n,
      coursesInReview: 0n,
      coursesPublished: 0n,
      coursesArchived: 0n,
      coursesDeleted: 0n,
      enrollmentsTotal: 0n,
      enrollmentsActive: 0n,
      enrollmentsSuspended: 0n,
      enrollmentsCompleted: 0n,
      enrollmentsCancelled: 0n,
      progressTrackedEnrollments: 0n,
      progressAverageCompletionPercentage: 0n,
      certificatesTotal: 0n,
      certificatesIssued: 0n,
      certificatesRevoked: 0n,
    });

    const result = await new AdminDashboardService(repository).getSummary(actor(), audit);
    expect(result.progress).toEqual({
      trackedEnrollments: 0,
      averageCompletionPercentage: 0,
    });
    expect(result.certificates.total).toBe(0);
  });

  it.each(unauthorizedActors)(
    'denies direct service access when %s',
    async (_label, unauthorizedActor) => {
      const repository = new FakeAdminDashboardRepository();
      const service = new AdminDashboardService(repository);
      await expect(service.getSummary(unauthorizedActor, audit)).rejects.toMatchObject({
        statusCode: 403,
        code: 'ACCESS_DENIED',
      });
      expect(repository.events).toEqual([]);
    },
  );

  it('rejects an actor/audit identity mismatch before persistence', async () => {
    const repository = new FakeAdminDashboardRepository();
    const service = new AdminDashboardService(repository);
    await expect(
      service.getSummary(actor(), {
        ...audit,
        actorUserId: '019d0000-0000-7000-8000-000000000999',
      }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'ACCESS_DENIED' });
    expect(repository.events).toEqual([]);
  });

  it.each([
    ['user soft-delete mismatch', { usersLifecycleMismatch: 1n }],
    ['user lifecycle sum', { usersActive: 7n }],
    ['course lifecycle sum', { coursesPublished: 2n }],
    ['enrollment lifecycle sum', { enrollmentsCancelled: 1n }],
    ['certificate lifecycle sum', { certificatesRevoked: 0n }],
    ['corrupt progress row signal', { invalidProgressCount: 1n }],
    ['invalid progress percentage', { progressAverageCompletionPercentage: 101n }],
    ['unsafe JSON count', { usersTotal: BigInt(Number.MAX_SAFE_INTEGER) + 1n }],
  ])('fails all-or-nothing for %s', async (_label, overrides) => {
    const repository = new FakeAdminDashboardRepository();
    repository.aggregate = aggregate(overrides);
    await expect(
      new AdminDashboardService(repository).getSummary(actor(), audit),
    ).rejects.toBeInstanceOf(AdminDashboardInvariantError);
    expect(repository.events).toEqual([
      'transaction.started',
      'aggregate.read',
      'transaction.rolled_back',
    ]);
  });

  it('rolls back when the success audit cannot be persisted', async () => {
    const repository = new FakeAdminDashboardRepository();
    repository.auditFailure = new Error('audit unavailable');
    await expect(new AdminDashboardService(repository).getSummary(actor(), audit)).rejects.toThrow(
      'audit unavailable',
    );
    expect(repository.events.at(-1)).toBe('transaction.rolled_back');
  });

  it('applies the same authorization before consuming a shared rate-limit slot', async () => {
    const repository = new FakeAdminDashboardRepository();
    const service = new AdminDashboardService(repository);
    await expect(service.consumeRateLimit(actor([RoleCode.TEACHER]), audit)).rejects.toMatchObject({
      statusCode: 403,
      code: 'ACCESS_DENIED',
    });
    expect(repository.consumeRateLimitSlot).not.toHaveBeenCalled();

    await expect(service.consumeRateLimit(actor(), audit)).resolves.toMatchObject({
      allowed: true,
      remaining: 29,
    });
    expect(repository.consumeRateLimitSlot).toHaveBeenCalledWith(audit);
  });
});
