import { RoleCode } from '@prisma/client';
import { AppError } from '../../utils/app-error.js';
import { AdminDashboardInvariantError } from './admin-dashboard.errors.js';
import { presentAdminDashboardSummary } from './admin-dashboard.presenter.js';
import type { AdminDashboardRepository } from './admin-dashboard.repository.js';
import {
  adminDashboardRequiredPermissions,
  type AdminDashboardActor,
  type AdminDashboardAggregateRow,
  type AdminDashboardAuditContext,
  type AdminDashboardRateLimitDecision,
  type AdminDashboardSummaryDto,
} from './admin-dashboard.types.js';

const MAX_SAFE_COUNT = BigInt(Number.MAX_SAFE_INTEGER);

function accessDenied(): AppError {
  return new AppError('Bu amal uchun ruxsat yetarli emas.', 403, 'ACCESS_DENIED');
}

function assertAuthorized(actor: AdminDashboardActor): void {
  if (
    !actor.roles.includes(RoleCode.ADMIN) ||
    !adminDashboardRequiredPermissions.every((permission) => actor.permissions.includes(permission))
  ) {
    throw accessDenied();
  }
}

function assertActorContext(actor: AdminDashboardActor, context: AdminDashboardAuditContext): void {
  if (actor.userId !== context.actorUserId) throw accessDenied();
}

function assertSafeCount(value: bigint, field: string): void {
  if (value < 0n || value > MAX_SAFE_COUNT) {
    throw new AdminDashboardInvariantError(`${field} is outside the JSON-safe count range`);
  }
}

function assertSum(total: bigint, values: readonly bigint[], field: string): void {
  if (values.reduce((sum, value) => sum + value, 0n) !== total) {
    throw new AdminDashboardInvariantError(`${field} lifecycle buckets do not equal total`);
  }
}

export function assertAdminDashboardAggregate(aggregate: AdminDashboardAggregateRow): void {
  const countFields = Object.entries(aggregate).filter(
    (entry): entry is [string, bigint] => typeof entry[1] === 'bigint',
  );
  for (const [field, value] of countFields) assertSafeCount(value, field);

  if (aggregate.usersLifecycleMismatch !== 0n) {
    throw new AdminDashboardInvariantError('users status/deletedAt pairing is inconsistent');
  }
  assertSum(
    aggregate.usersTotal,
    [
      aggregate.usersActive,
      aggregate.usersSuspended,
      aggregate.usersDeactivated,
      aggregate.usersDeleted,
    ],
    'users',
  );
  assertSum(
    aggregate.coursesTotal,
    [
      aggregate.coursesDraft,
      aggregate.coursesInReview,
      aggregate.coursesPublished,
      aggregate.coursesArchived,
      aggregate.coursesDeleted,
    ],
    'courses',
  );
  assertSum(
    aggregate.enrollmentsTotal,
    [
      aggregate.enrollmentsActive,
      aggregate.enrollmentsSuspended,
      aggregate.enrollmentsCompleted,
      aggregate.enrollmentsCancelled,
    ],
    'enrollments',
  );
  assertSum(
    aggregate.certificatesTotal,
    [aggregate.certificatesIssued, aggregate.certificatesRevoked],
    'certificates',
  );
  if (aggregate.invalidProgressCount !== 0n) {
    throw new AdminDashboardInvariantError('progress contains an out-of-range percentage');
  }
  if (
    aggregate.progressAverageCompletionPercentage < 0n ||
    aggregate.progressAverageCompletionPercentage > 100n ||
    (aggregate.progressTrackedEnrollments === 0n &&
      aggregate.progressAverageCompletionPercentage !== 0n)
  ) {
    throw new AdminDashboardInvariantError('progress average is inconsistent');
  }
}

export interface AdminDashboardUseCases {
  consumeRateLimit(
    actor: AdminDashboardActor,
    context: AdminDashboardAuditContext,
  ): Promise<AdminDashboardRateLimitDecision>;
  getSummary(
    actor: AdminDashboardActor,
    context: AdminDashboardAuditContext,
  ): Promise<AdminDashboardSummaryDto>;
}

export class AdminDashboardService implements AdminDashboardUseCases {
  constructor(private readonly repository: AdminDashboardRepository) {}

  async consumeRateLimit(
    actor: AdminDashboardActor,
    context: AdminDashboardAuditContext,
  ): Promise<AdminDashboardRateLimitDecision> {
    assertAuthorized(actor);
    assertActorContext(actor, context);
    return await this.repository.consumeRateLimitSlot(context);
  }

  async getSummary(
    actor: AdminDashboardActor,
    context: AdminDashboardAuditContext,
  ): Promise<AdminDashboardSummaryDto> {
    assertAuthorized(actor);
    assertActorContext(actor, context);
    return await this.repository.withRepeatableReadTransaction(async (transaction) => {
      const aggregate = await transaction.readAggregate();
      assertAdminDashboardAggregate(aggregate);
      const response = presentAdminDashboardSummary(aggregate);
      await transaction.recordSummaryRead(context, aggregate.generatedAt);
      return response;
    });
  }
}
