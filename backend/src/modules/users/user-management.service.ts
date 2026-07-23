import { RoleCode, UserStatus } from '@prisma/client';
import { AppError } from '../../utils/app-error.js';
import {
  LastActiveAdministratorError,
  RoleCatalogMismatchError,
  UserEmailConflictError,
  type UserManagementRepository,
} from './user-management.repository.js';
import type {
  AuditContext,
  CreateUserData,
  PaginatedUsers,
  UpdateUserData,
  UserDetailRecord,
  UserListQuery,
  UserManagementActor,
  UserManagementRecord,
  UserStatistics,
} from './user-management.types.js';

const statusPermission: Record<Exclude<UserStatus, 'DELETED'>, string> = {
  ACTIVE: 'users.restore',
  SUSPENDED: 'users.suspend',
  DEACTIVATED: 'users.deactivate',
};

function userNotFound(): AppError {
  return new AppError('Foydalanuvchi topilmadi.', 404, 'USER_NOT_FOUND');
}

function userDeleted(): AppError {
  return new AppError('O‘chirilgan foydalanuvchini avval tiklash kerak.', 409, 'USER_IS_DELETED');
}

function translateRepositoryError(error: unknown): never {
  if (error instanceof UserEmailConflictError) {
    throw new AppError(
      'Bu email manzil bilan foydalanuvchi allaqachon mavjud.',
      409,
      'USER_EMAIL_CONFLICT',
    );
  }

  if (error instanceof RoleCatalogMismatchError) {
    throw new AppError('Tanlangan rollardan biri tizimda mavjud emas.', 409, 'ROLE_NOT_AVAILABLE');
  }

  if (error instanceof LastActiveAdministratorError) {
    throw new AppError(
      'Tizimda kamida bitta faol administrator qolishi kerak.',
      409,
      'LAST_ACTIVE_ADMIN_REQUIRED',
    );
  }

  throw error;
}

function sameRoles(current: RoleCode[], next: RoleCode[]): boolean {
  return (
    current.length === next.length &&
    current.every((role) => next.includes(role)) &&
    next.every((role) => current.includes(role))
  );
}

export interface UserManagementUseCases {
  list(query: UserListQuery): Promise<PaginatedUsers>;
  getById(userId: string): Promise<UserDetailRecord>;
  create(data: CreateUserData, context: AuditContext): Promise<UserManagementRecord>;
  update(
    userId: string,
    data: UpdateUserData,
    context: AuditContext,
  ): Promise<UserManagementRecord>;
  updateStatus(
    userId: string,
    status: Exclude<UserStatus, 'DELETED'>,
    actor: UserManagementActor,
    context: AuditContext,
  ): Promise<UserManagementRecord>;
  replaceRoles(
    userId: string,
    roles: RoleCode[],
    actor: UserManagementActor,
    context: AuditContext,
  ): Promise<UserManagementRecord>;
  delete(userId: string, actor: UserManagementActor, context: AuditContext): Promise<void>;
  restore(userId: string, context: AuditContext): Promise<UserManagementRecord>;
  getStatistics(): Promise<UserStatistics>;
}

export class UserManagementService implements UserManagementUseCases {
  constructor(private readonly repository: UserManagementRepository) {}

  async list(query: UserListQuery): Promise<PaginatedUsers> {
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

  async getById(userId: string): Promise<UserDetailRecord> {
    const user = await this.repository.findById(userId);

    if (!user) {
      throw userNotFound();
    }

    return user;
  }

  async create(data: CreateUserData, context: AuditContext): Promise<UserManagementRecord> {
    try {
      return await this.repository.create(data, context);
    } catch (error: unknown) {
      return translateRepositoryError(error);
    }
  }

  async update(
    userId: string,
    data: UpdateUserData,
    context: AuditContext,
  ): Promise<UserManagementRecord> {
    const existing = await this.repository.findById(userId);

    if (!existing) {
      throw userNotFound();
    }

    if (existing.deletedAt) {
      throw userDeleted();
    }

    try {
      return (
        (await this.repository.update(userId, data, context)) ??
        (() => {
          throw userNotFound();
        })()
      );
    } catch (error: unknown) {
      return translateRepositoryError(error);
    }
  }

  async updateStatus(
    userId: string,
    status: Exclude<UserStatus, 'DELETED'>,
    actor: UserManagementActor,
    context: AuditContext,
  ): Promise<UserManagementRecord> {
    const requiredPermission = statusPermission[status];

    if (!actor.permissions.includes(requiredPermission)) {
      throw new AppError('Bu amal uchun ruxsat yetarli emas.', 403, 'ACCESS_DENIED');
    }

    const existing = await this.repository.findById(userId);

    if (!existing) {
      throw userNotFound();
    }

    if (existing.deletedAt) {
      throw userDeleted();
    }

    if (actor.userId === userId && status !== UserStatus.ACTIVE) {
      throw new AppError(
        'Administrator o‘z hisobini bloklay yoki faolsizlantira olmaydi.',
        409,
        'SELF_STATUS_CHANGE_FORBIDDEN',
      );
    }

    if (existing.status === status) {
      return existing;
    }

    try {
      return (
        (await this.repository.updateStatus(userId, status, context)) ??
        (() => {
          throw userNotFound();
        })()
      );
    } catch (error: unknown) {
      return translateRepositoryError(error);
    }
  }

  async replaceRoles(
    userId: string,
    roles: RoleCode[],
    actor: UserManagementActor,
    context: AuditContext,
  ): Promise<UserManagementRecord> {
    const existing = await this.repository.findById(userId);

    if (!existing) {
      throw userNotFound();
    }

    if (existing.deletedAt) {
      throw userDeleted();
    }

    if (
      actor.userId === userId &&
      existing.roles.includes(RoleCode.ADMIN) &&
      !roles.includes(RoleCode.ADMIN)
    ) {
      throw new AppError(
        'Administrator o‘z ADMIN rolini olib tashlay olmaydi.',
        409,
        'SELF_ADMIN_ROLE_REMOVAL_FORBIDDEN',
      );
    }

    if (sameRoles(existing.roles, roles)) {
      return existing;
    }

    try {
      return (
        (await this.repository.replaceRoles(userId, roles, context)) ??
        (() => {
          throw userNotFound();
        })()
      );
    } catch (error: unknown) {
      return translateRepositoryError(error);
    }
  }

  async delete(userId: string, actor: UserManagementActor, context: AuditContext): Promise<void> {
    if (actor.userId === userId) {
      throw new AppError(
        'Administrator o‘z hisobini o‘chira olmaydi.',
        409,
        'SELF_DELETE_FORBIDDEN',
      );
    }

    try {
      const deleted = await this.repository.softDelete(userId, context);

      if (!deleted) {
        throw userNotFound();
      }
    } catch (error: unknown) {
      translateRepositoryError(error);
    }
  }

  async restore(userId: string, context: AuditContext): Promise<UserManagementRecord> {
    const existing = await this.repository.findById(userId);

    if (!existing) {
      throw userNotFound();
    }

    if (!existing.deletedAt || existing.status !== UserStatus.DELETED) {
      throw new AppError(
        'Faqat o‘chirilgan foydalanuvchini tiklash mumkin.',
        409,
        'USER_NOT_DELETED',
      );
    }

    const restored = await this.repository.restore(userId, context);

    if (!restored) {
      throw userNotFound();
    }

    return restored;
  }

  getStatistics(): Promise<UserStatistics> {
    return this.repository.statistics();
  }
}
