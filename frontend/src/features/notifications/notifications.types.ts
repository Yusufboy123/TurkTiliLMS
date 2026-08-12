export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  targetUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPage {
  items: NotificationItem[];
  unreadCount: number;
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

export type NotificationAudience = 'STUDENT' | 'TEACHER' | 'ALL';
