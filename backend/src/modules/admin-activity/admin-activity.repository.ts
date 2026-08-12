import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { AdminActivityQuery, AdminActivityRecord } from './admin-activity.types.js';

const activitySelect = {
  id: true,
  action: true,
  subjectType: true,
  subjectId: true,
  occurredAt: true,
  actor: { select: { id: true, email: true, firstName: true, lastName: true, displayName: true } },
  afterSummary: true,
  beforeSummary: true,
} satisfies Prisma.AuditLogSelect;
type ActivityPayload = Prisma.AuditLogGetPayload<{ select: typeof activitySelect }>;

const importantActions = [
  'users.roles.replaced',
  'users.status.active',
  'users.status.suspended',
  'users.status.deactivated',
  'users.deleted',
  'users.restored',
  'groups.created',
  'groups.deleted',
  'groups.restored',
  'groups.student_added',
  'groups.student_removed',
  'courses.created',
  'courses.status_changed',
  'courses.published',
  'LESSON_CREATED',
  'LESSON_DUPLICATED',
  'LESSON_DELETED',
  'course_enrollments.created',
  'course_enrollments.active',
  'course_enrollments.suspended',
  'course_enrollments.completed',
  'course_enrollments.cancelled',
  'course_enrollments.access_updated',
  'certificate.issued',
  'certificate.revoked',
] as const;

function scalarText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 160) : null;
}

function targetLabel(value: Prisma.JsonValue | null): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  for (const key of ['displayName', 'name', 'title', 'sourceTitle', 'email']) {
    const text = scalarText(record[key]);
    if (text) return text;
  }
  return null;
}

function present(record: ActivityPayload): AdminActivityRecord {
  const actor = record.actor;
  const actorName = actor?.displayName || [actor?.firstName, actor?.lastName].filter(Boolean).join(' ') || actor?.email || 'Tizim';
  const target = targetLabel(record.afterSummary) ?? targetLabel(record.beforeSummary);
  return {
    id: record.id,
    actor: actor ? { id: actor.id, name: actorName, email: actor.email } : null,
    action: record.action,
    entityType: record.subjectType,
    entityId: record.subjectId,
    summary: target ? `${record.action} — ${target}` : record.action,
    createdAt: record.occurredAt.toISOString(),
  };
}

export interface AdminActivityRepository {
  list(query: AdminActivityQuery): Promise<{ items: AdminActivityRecord[]; total: number }>;
}

function whereFor(query: AdminActivityQuery): Prisma.AuditLogWhereInput {
  return {
    ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
    action: query.action ? { equals: query.action } : { in: [...importantActions] },
    ...(query.entityType ? { subjectType: query.entityType } : {}),
    ...(query.from || query.to
      ? { occurredAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } }
      : {}),
  };
}

export class PrismaAdminActivityRepository implements AdminActivityRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async list(query: AdminActivityQuery): Promise<{ items: AdminActivityRecord[]; total: number }> {
    const where = whereFor(query);
    const [rows, total] = await this.client.$transaction([
      this.client.auditLog.findMany({
        where,
        select: activitySelect,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.client.auditLog.count({ where }),
    ]);
    return { items: rows.map(present), total };
  }
}
