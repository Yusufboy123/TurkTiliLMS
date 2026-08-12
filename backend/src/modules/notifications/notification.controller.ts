import type { Request, Response } from 'express';
import { AppError } from '../../utils/app-error.js';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types.js';
import { announcementSchema, notificationIdSchema, notificationQuerySchema } from './notification.schemas.js';
import type { NotificationService } from './notification.service.js';

function principal(req: Request): AuthenticatedPrincipal { const auth = (req as Request & { auth?: AuthenticatedPrincipal }).auth; if (!auth) throw new AppError('Davom etish uchun tizimga kirish talab qilinadi.', 401, 'AUTHENTICATION_REQUIRED'); return auth; }
function actor(req: Request) { const auth = principal(req); return { userId: auth.userId, roles: auth.roles, permissions: auth.permissions }; }

export class NotificationController {
  constructor(private readonly service: NotificationService) {}
  list = async (req: Request, res: Response) => { res.setHeader('Cache-Control', 'no-store'); res.json({ success: true, message: 'Bildirishnomalar olindi.', data: await this.service.list(actor(req), notificationQuerySchema.parse(req.query)) }); };
  markRead = async (req: Request, res: Response) => { await this.service.markRead(actor(req), notificationIdSchema.parse(req.params).notificationId); res.status(204).send(); };
  markAllRead = async (req: Request, res: Response) => { const count = await this.service.markAllRead(actor(req)); res.json({ success: true, message: 'Bildirishnomalar o‘qilgan deb belgilandi.', data: { count } }); };
  announce = async (req: Request, res: Response) => { const count = await this.service.announce(actor(req), announcementSchema.parse(req.body)); res.status(201).json({ success: true, message: 'E’lon yuborildi.', data: { count } }); };
}
