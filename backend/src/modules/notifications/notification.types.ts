import type { RoleCode } from '@prisma/client';

export type NotificationAudience = 'STUDENT' | 'TEACHER' | 'ALL';

export interface NotificationActor {
  readonly userId: string;
  readonly roles: readonly RoleCode[];
  readonly permissions: readonly string[];
}

export interface NotificationQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly unread?: boolean | undefined;
}

export interface NotificationRecord {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly message: string;
  readonly targetUrl: string | null;
  readonly readAt: string | null;
  readonly createdAt: string;
}

export interface NotificationPage {
  readonly items: NotificationRecord[];
  readonly unreadCount: number;
  readonly pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

export interface AnnouncementInput {
  readonly audience: NotificationAudience;
  readonly title: string;
  readonly message: string;
  readonly targetUrl?: string | null | undefined;
}
