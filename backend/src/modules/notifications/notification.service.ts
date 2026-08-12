import { RoleCode } from '@prisma/client';
import { AppError } from '../../utils/app-error.js';
import type { AnnouncementInput } from './notification.schemas.js';
import type { NotificationRepository } from './notification.repository.js';
import type { NotificationActor, NotificationPage, NotificationQuery } from './notification.types.js';

function assertOwner(actor: NotificationActor) { if (!actor.roles.some((role) => [RoleCode.ADMIN, RoleCode.TEACHER, RoleCode.STUDENT].includes(role))) throw new AppError('Bu amal uchun ruxsat yetarli emas.', 403, 'ACCESS_DENIED'); }
function assertAdmin(actor: NotificationActor) { if (!actor.roles.includes(RoleCode.ADMIN)) throw new AppError('Bu amal uchun ruxsat yetarli emas.', 403, 'ACCESS_DENIED'); }

export class NotificationService {
  constructor(private readonly repository: NotificationRepository) {}
  async list(actor: NotificationActor, query: NotificationQuery): Promise<NotificationPage> { assertOwner(actor); if (actor.roles.includes(RoleCode.STUDENT)) await this.repository.generateDueWarnings(actor.userId, new Date()); const result = await this.repository.list(actor.userId, query); return { items: result.items, unreadCount: result.unreadCount, pagination: { page: query.page, pageSize: query.pageSize, totalItems: result.total, totalPages: Math.ceil(result.total / query.pageSize) } }; }
  async markRead(actor: NotificationActor, id: string) { assertOwner(actor); if (!(await this.repository.markRead(actor.userId, id))) throw new AppError('Bildirishnoma topilmadi.', 404, 'NOTIFICATION_NOT_FOUND'); }
  async markAllRead(actor: NotificationActor) { assertOwner(actor); return this.repository.markAllRead(actor.userId); }
  async announce(actor: NotificationActor, input: AnnouncementInput) { assertAdmin(actor); return this.repository.announce(input); }
}
