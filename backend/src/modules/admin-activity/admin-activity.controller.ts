import type { Request, Response } from 'express';
import { AppError } from '../../utils/app-error.js';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types.js';
import { adminActivityQuerySchema } from './admin-activity.schemas.js';
import type { AdminActivityService } from './admin-activity.service.js';

function principal(request: Request): AuthenticatedPrincipal {
  const value = (request as Request & { auth?: AuthenticatedPrincipal }).auth;
  if (!value) throw new AppError('Davom etish uchun tizimga kirish talab qilinadi.', 401, 'AUTHENTICATION_REQUIRED');
  return value;
}

export class AdminActivityController {
  constructor(private readonly service: AdminActivityService) {}

  list = async (request: Request, response: Response): Promise<void> => {
    const auth = principal(request);
    const query = adminActivityQuerySchema.parse(request.query);
    response.setHeader('Cache-Control', 'no-store');
    response.status(200).json({
      success: true,
      message: 'Faoliyat tarixi olindi.',
      data: await this.service.list(
        { userId: auth.userId, roles: auth.roles, permissions: auth.permissions },
        query,
      ),
    });
  };
}
