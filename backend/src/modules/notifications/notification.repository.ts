import { Prisma, RoleCode, type PrismaClient } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { AnnouncementInput, NotificationQuery, NotificationRecord } from './notification.types.js';

const notificationSelect = { id: true, type: true, title: true, message: true, targetUrl: true, readAt: true, createdAt: true } satisfies Prisma.NotificationSelect;
type NotificationPayload = Prisma.NotificationGetPayload<{ select: typeof notificationSelect }>;

function mapNotification(value: NotificationPayload): NotificationRecord {
  return { ...value, readAt: value.readAt?.toISOString() ?? null, createdAt: value.createdAt.toISOString() };
}

export interface NotificationRepository {
  list(userId: string, query: NotificationQuery): Promise<{ items: NotificationRecord[]; total: number; unreadCount: number }>;
  markRead(userId: string, notificationId: string): Promise<boolean>;
  markAllRead(userId: string): Promise<number>;
  create(data: { userId: string; type: string; title: string; message: string; targetUrl?: string | null; dedupeKey?: string | null }): Promise<void>;
  announce(input: AnnouncementInput): Promise<number>;
  generateDueWarnings(userId: string, now: Date): Promise<void>;
}

export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async list(userId: string, query: NotificationQuery) {
    const where = { userId, ...(query.unread === true ? { readAt: null } : {}) } satisfies Prisma.NotificationWhereInput;
    const [rows, total, unreadCount] = await this.client.$transaction([
      this.client.notification.findMany({ where, select: notificationSelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.client.notification.count({ where }),
      this.client.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items: rows.map(mapNotification), total, unreadCount };
  }

  async markRead(userId: string, notificationId: string) {
    const result = await this.client.notification.updateMany({ where: { id: notificationId, userId, readAt: null }, data: { readAt: new Date() } });
    return result.count > 0;
  }

  async markAllRead(userId: string) {
    const result = await this.client.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return result.count;
  }

  async create(data: { userId: string; type: string; title: string; message: string; targetUrl?: string | null; dedupeKey?: string | null }) {
    try {
      await this.client.notification.create({ data });
    } catch (error: unknown) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
    }
  }

  async announce(input: AnnouncementInput) {
    const role = input.audience === 'STUDENT' ? RoleCode.STUDENT : input.audience === 'TEACHER' ? RoleCode.TEACHER : undefined;
    const users = await this.client.user.findMany({ where: { status: 'ACTIVE', deletedAt: null, ...(role ? { roles: { some: { role: { code: role }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } } } : {}) }, select: { id: true } });
    if (!users.length) return 0;
    const result = await this.client.notification.createMany({ data: users.map(({ id }) => ({ userId: id, type: 'ANNOUNCEMENT', title: input.title, message: input.message, targetUrl: input.targetUrl ?? null })) });
    return result.count;
  }

  async generateDueWarnings(userId: string, now: Date) {
    const enrollments = await this.client.courseEnrollment.findMany({ where: { studentId: userId, status: { in: ['ACTIVE', 'SUSPENDED'] } }, select: { id: true, courseId: true, accessExpiresAt: true, course: { select: { title: true } } } });
    for (const enrollment of enrollments) {
      const remainingDays = Math.ceil((enrollment.accessExpiresAt.getTime() - now.getTime()) / 86_400_000);
      const kind = remainingDays <= 0 ? 'EXPIRED' : remainingDays <= 1 ? 'ONE_DAY' : remainingDays <= 7 ? 'SEVEN_DAYS' : null;
      if (!kind) continue;
      await this.create({ userId, type: `COURSE_ACCESS_${kind}`, title: 'Kursga kirish', message: kind === 'EXPIRED' ? `${enrollment.course.title} kursiga kirish muddati tugadi.` : kind === 'ONE_DAY' ? `${enrollment.course.title} kursiga kirish muddati ertaga tugaydi.` : `${enrollment.course.title} kursiga kirish muddati tugashiga 7 kun qoldi.`, targetUrl: `/app/courses/${enrollment.courseId}`, dedupeKey: `course-access:${enrollment.id}:${kind}` });
    }
  }
}
