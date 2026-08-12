import { z } from 'zod';

const safeTargetUrl = z.string().trim().max(500).refine((value) => value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') && !/^[a-z][a-z0-9+.-]*:/iu.test(value), 'Xavfsiz ichki manzil kiriting.');

export const notificationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  unread: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
}).strict();

export const notificationIdSchema = z.object({ notificationId: z.uuid() }).strict();
export const announcementSchema = z.object({
  audience: z.enum(['STUDENT', 'TEACHER', 'ALL']),
  title: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(1000),
  targetUrl: safeTargetUrl.nullable().optional(),
}).strict();

export type AnnouncementInput = z.infer<typeof announcementSchema>;
