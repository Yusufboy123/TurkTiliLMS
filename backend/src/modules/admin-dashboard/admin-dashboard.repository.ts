import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type {
  AdminDashboardAggregateRow,
  AdminDashboardAuditContext,
  AdminDashboardRateLimitDecision,
} from './admin-dashboard.types.js';

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT_ACTION = 'admin_dashboard.summary_rate_slot_consumed';

export const adminDashboardAggregateSql = Prisma.sql`
  WITH "snapshot" AS (
    SELECT transaction_timestamp() AS "generated_at"
  ),
  "user_counts" AS (
    SELECT
      COUNT(*)::BIGINT AS "total",
      COUNT(*) FILTER (WHERE "status" = 'ACTIVE' AND "deleted_at" IS NULL)::BIGINT AS "active",
      COUNT(*) FILTER (WHERE "status" = 'SUSPENDED' AND "deleted_at" IS NULL)::BIGINT AS "suspended",
      COUNT(*) FILTER (WHERE "status" = 'DEACTIVATED' AND "deleted_at" IS NULL)::BIGINT AS "deactivated",
      COUNT(*) FILTER (WHERE "status" = 'DELETED' AND "deleted_at" IS NOT NULL)::BIGINT AS "deleted",
      COUNT(*) FILTER (
        WHERE ("status" = 'DELETED') <> ("deleted_at" IS NOT NULL)
      )::BIGINT AS "lifecycle_mismatch"
    FROM "users"
  ),
  "role_counts" AS (
    SELECT
      COUNT(DISTINCT "ur"."user_id") FILTER (WHERE "r"."code" = 'STUDENT')::BIGINT AS "students",
      COUNT(DISTINCT "ur"."user_id") FILTER (WHERE "r"."code" = 'TEACHER')::BIGINT AS "teachers",
      COUNT(DISTINCT "ur"."user_id") FILTER (WHERE "r"."code" = 'ADMIN')::BIGINT AS "administrators"
    FROM "user_roles" AS "ur"
    INNER JOIN "roles" AS "r" ON "r"."id" = "ur"."role_id"
    INNER JOIN "users" AS "u" ON "u"."id" = "ur"."user_id"
    CROSS JOIN "snapshot" AS "s"
    WHERE "u"."deleted_at" IS NULL
      AND "u"."status" <> 'DELETED'
      AND "ur"."assigned_at" <= "s"."generated_at"
      AND ("ur"."expires_at" IS NULL OR "ur"."expires_at" > "s"."generated_at")
  ),
  "course_counts" AS (
    SELECT
      COUNT(*)::BIGINT AS "total",
      COUNT(*) FILTER (WHERE "deleted_at" IS NULL AND "status" = 'DRAFT')::BIGINT AS "draft",
      COUNT(*) FILTER (WHERE "deleted_at" IS NULL AND "status" = 'IN_REVIEW')::BIGINT AS "in_review",
      COUNT(*) FILTER (WHERE "deleted_at" IS NULL AND "status" = 'PUBLISHED')::BIGINT AS "published",
      COUNT(*) FILTER (WHERE "deleted_at" IS NULL AND "status" = 'ARCHIVED')::BIGINT AS "archived",
      COUNT(*) FILTER (WHERE "deleted_at" IS NOT NULL)::BIGINT AS "deleted"
    FROM "courses"
  ),
  "enrollment_counts" AS (
    SELECT
      COUNT(*)::BIGINT AS "total",
      COUNT(*) FILTER (WHERE "status" = 'ACTIVE')::BIGINT AS "active",
      COUNT(*) FILTER (WHERE "status" = 'SUSPENDED')::BIGINT AS "suspended",
      COUNT(*) FILTER (WHERE "status" = 'COMPLETED')::BIGINT AS "completed",
      COUNT(*) FILTER (WHERE "status" = 'CANCELLED')::BIGINT AS "cancelled"
    FROM "course_enrollments"
  ),
  "progress_counts" AS (
    SELECT
      COUNT(*)::BIGINT AS "tracked_enrollments",
      COUNT(*) FILTER (
        WHERE "course_percentage" < 0 OR "course_percentage" > 100
      )::BIGINT AS "invalid_progress_count",
      COALESCE(FLOOR(AVG("course_percentage"::NUMERIC)), 0)::BIGINT
        AS "average_completion_percentage"
    FROM "enrollment_progress_roots"
  ),
  "certificate_counts" AS (
    SELECT
      COUNT(*)::BIGINT AS "total",
      COUNT(*) FILTER (WHERE "status" = 'ISSUED')::BIGINT AS "issued",
      COUNT(*) FILTER (WHERE "status" = 'REVOKED')::BIGINT AS "revoked"
    FROM "certificates"
  )
  SELECT
    "s"."generated_at" AS "generatedAt",
    "u"."total" AS "usersTotal",
    "u"."active" AS "usersActive",
    "u"."suspended" AS "usersSuspended",
    "u"."deactivated" AS "usersDeactivated",
    "u"."deleted" AS "usersDeleted",
    "u"."lifecycle_mismatch" AS "usersLifecycleMismatch",
    "r"."students" AS "usersStudents",
    "r"."teachers" AS "usersTeachers",
    "r"."administrators" AS "usersAdministrators",
    "c"."total" AS "coursesTotal",
    "c"."draft" AS "coursesDraft",
    "c"."in_review" AS "coursesInReview",
    "c"."published" AS "coursesPublished",
    "c"."archived" AS "coursesArchived",
    "c"."deleted" AS "coursesDeleted",
    "e"."total" AS "enrollmentsTotal",
    "e"."active" AS "enrollmentsActive",
    "e"."suspended" AS "enrollmentsSuspended",
    "e"."completed" AS "enrollmentsCompleted",
    "e"."cancelled" AS "enrollmentsCancelled",
    "p"."tracked_enrollments" AS "progressTrackedEnrollments",
    "p"."invalid_progress_count" AS "invalidProgressCount",
    "p"."average_completion_percentage" AS "progressAverageCompletionPercentage",
    "cert"."total" AS "certificatesTotal",
    "cert"."issued" AS "certificatesIssued",
    "cert"."revoked" AS "certificatesRevoked"
  FROM "snapshot" AS "s"
  CROSS JOIN "user_counts" AS "u"
  CROSS JOIN "role_counts" AS "r"
  CROSS JOIN "course_counts" AS "c"
  CROSS JOIN "enrollment_counts" AS "e"
  CROSS JOIN "progress_counts" AS "p"
  CROSS JOIN "certificate_counts" AS "cert"
`;

export interface AdminDashboardTransactionRepository {
  readAggregate(): Promise<AdminDashboardAggregateRow>;
  recordSummaryRead(context: AdminDashboardAuditContext, occurredAt: Date): Promise<void>;
}

export interface AdminDashboardRepository {
  withRepeatableReadTransaction<T>(
    operation: (transaction: AdminDashboardTransactionRepository) => Promise<T>,
  ): Promise<T>;
  consumeRateLimitSlot(
    context: AdminDashboardAuditContext,
  ): Promise<AdminDashboardRateLimitDecision>;
}

class PrismaAdminDashboardTransactionRepository implements AdminDashboardTransactionRepository {
  constructor(private readonly transaction: Prisma.TransactionClient) {}

  async readAggregate(): Promise<AdminDashboardAggregateRow> {
    const rows = await this.transaction.$queryRaw<AdminDashboardAggregateRow[]>(
      adminDashboardAggregateSql,
    );
    const aggregate = rows[0];
    if (!aggregate) throw new Error('Admin Dashboard aggregate query returned no row.');
    return aggregate;
  }

  async recordSummaryRead(context: AdminDashboardAuditContext, occurredAt: Date): Promise<void> {
    await this.transaction.auditLog.create({
      data: {
        actorUserId: context.actorUserId,
        action: 'admin_dashboard.summary_read',
        subjectType: 'admin_dashboard',
        occurredAt,
        ...(context.requestCorrelationId
          ? { requestCorrelationId: context.requestCorrelationId }
          : {}),
        ...(context.ipHash ? { ipHash: context.ipHash } : {}),
        ...(context.userAgentSummary ? { userAgentSummary: context.userAgentSummary } : {}),
      },
    });
  }
}

export class PrismaAdminDashboardRepository implements AdminDashboardRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  withRepeatableReadTransaction<T>(
    operation: (transaction: AdminDashboardTransactionRepository) => Promise<T>,
  ): Promise<T> {
    return this.client.$transaction(
      (transaction) => operation(new PrismaAdminDashboardTransactionRepository(transaction)),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  consumeRateLimitSlot(
    context: AdminDashboardAuditContext,
  ): Promise<AdminDashboardRateLimitDecision> {
    return this.client.$transaction(
      async (transaction) => {
        const scope = `admin-dashboard:summary:${context.actorUserId}:${context.ipHash}`;
        const lockRows = await transaction.$queryRaw<{ lockAcquired: number }[]>`
          WITH "rate_limit_lock" AS MATERIALIZED (
            SELECT pg_advisory_xact_lock(hashtextextended(${scope}, 0))
          )
          SELECT 1::INTEGER AS "lockAcquired"
          FROM "rate_limit_lock"
        `;
        if (lockRows[0]?.lockAcquired !== 1) {
          throw new Error('Admin Dashboard rate-limit lock could not be acquired.');
        }

        const timestampRows = await transaction.$queryRaw<{ currentTime: Date }[]>`
          SELECT clock_timestamp() AS "currentTime"
        `;
        const currentTime = timestampRows[0]?.currentTime;
        if (!currentTime) throw new Error('Admin Dashboard rate-limit clock could not be read.');

        const since = new Date(currentTime.getTime() - RATE_WINDOW_MS);
        const where = {
          actorUserId: context.actorUserId,
          action: RATE_LIMIT_ACTION,
          ipHash: context.ipHash,
          occurredAt: { gte: since },
        } satisfies Prisma.AuditLogWhereInput;
        const [requestCount, oldestSlot] = await Promise.all([
          transaction.auditLog.count({ where }),
          transaction.auditLog.findFirst({
            where,
            orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
            select: { occurredAt: true },
          }),
        ]);

        const resetAfterSeconds = Math.max(
          1,
          Math.ceil(
            ((oldestSlot?.occurredAt.getTime() ?? currentTime.getTime()) +
              RATE_WINDOW_MS -
              currentTime.getTime()) /
              1000,
          ),
        );
        if (requestCount >= RATE_LIMIT) {
          return {
            allowed: false,
            limit: RATE_LIMIT,
            remaining: 0,
            resetAfterSeconds,
          };
        }

        await transaction.auditLog.create({
          data: {
            actorUserId: context.actorUserId,
            action: RATE_LIMIT_ACTION,
            subjectType: 'admin_dashboard',
            occurredAt: currentTime,
            ...(context.requestCorrelationId
              ? { requestCorrelationId: context.requestCorrelationId }
              : {}),
            ipHash: context.ipHash,
          },
        });

        return {
          allowed: true,
          limit: RATE_LIMIT,
          remaining: RATE_LIMIT - requestCount - 1,
          resetAfterSeconds,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }
}
