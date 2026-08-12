import { RoleCode } from '@prisma/client';
import { AppError } from '../../utils/app-error.js';
import type { AdminActivityRepository } from './admin-activity.repository.js';
import type { AdminActivityActor, AdminActivityPage, AdminActivityQuery } from './admin-activity.types.js';

const requiredPermission = 'audit.read';

function assertAccess(actor: AdminActivityActor): void {
  if (!actor.roles.includes(RoleCode.ADMIN) || !actor.permissions.includes(requiredPermission)) {
    throw new AppError('Bu amal uchun ruxsat yetarli emas.', 403, 'ACCESS_DENIED');
  }
}

export class AdminActivityService {
  constructor(private readonly repository: AdminActivityRepository) {}

  async list(actor: AdminActivityActor, query: AdminActivityQuery): Promise<AdminActivityPage> {
    assertAccess(actor);
    const result = await this.repository.list(query);
    return {
      items: result.items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems: result.total,
        totalPages: Math.ceil(result.total / query.pageSize),
      },
    };
  }
}
