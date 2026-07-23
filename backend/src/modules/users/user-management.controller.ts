import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { AppError } from '../../utils/app-error.js';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types.js';
import {
  createUserSchema,
  deleteUserSchema,
  listUsersQuerySchema,
  replaceUserRolesSchema,
  updateUserSchema,
  updateUserStatusSchema,
  userIdParamsSchema,
} from './user-management.schemas.js';
import type { UserManagementUseCases } from './user-management.service.js';
import type { AuditContext, UserManagementActor } from './user-management.types.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function principalFrom(request: Request): AuthenticatedPrincipal {
  const principal = (request as Request & { auth?: AuthenticatedPrincipal }).auth;

  if (!principal) {
    throw new AppError(
      'Davom etish uchun tizimga kirish talab qilinadi.',
      401,
      'AUTHENTICATION_REQUIRED',
    );
  }

  return principal;
}

function actorFrom(principal: AuthenticatedPrincipal): UserManagementActor {
  return {
    userId: principal.userId,
    permissions: principal.permissions,
  };
}

function auditContext(request: Request, principal: AuthenticatedPrincipal): AuditContext {
  const requestId = request.header('x-request-id');
  const userAgent = request.header('user-agent')?.slice(0, 512);
  const ipHash = request.ip ? createHash('sha256').update(request.ip).digest('hex') : undefined;

  return {
    actorUserId: principal.userId,
    ...(requestId && uuidPattern.test(requestId) ? { requestCorrelationId: requestId } : {}),
    ...(ipHash ? { ipHash } : {}),
    ...(userAgent ? { userAgentSummary: userAgent } : {}),
  };
}

export class UserManagementController {
  constructor(private readonly users: UserManagementUseCases) {}

  list = async (request: Request, response: Response): Promise<void> => {
    const query = listUsersQuerySchema.parse(request.query);
    const result = await this.users.list(query);

    response.status(200).json({
      success: true,
      message: 'Foydalanuvchilar ro‘yxati olindi.',
      data: result,
    });
  };

  statistics = async (_request: Request, response: Response): Promise<void> => {
    const result = await this.users.getStatistics();

    response.status(200).json({
      success: true,
      message: 'Foydalanuvchilar statistikasi olindi.',
      data: result,
    });
  };

  getById = async (request: Request, response: Response): Promise<void> => {
    const { userId } = userIdParamsSchema.parse(request.params);
    const result = await this.users.getById(userId);

    response.status(200).json({
      success: true,
      message: 'Foydalanuvchi ma’lumotlari olindi.',
      data: result,
    });
  };

  create = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const input = createUserSchema.parse(request.body);
    const result = await this.users.create(input, auditContext(request, principal));

    response.location(`/api/v1/users/${result.id}`).status(201).json({
      success: true,
      message: 'Foydalanuvchi yaratildi.',
      data: result,
    });
  };

  update = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { userId } = userIdParamsSchema.parse(request.params);
    const input = updateUserSchema.parse(request.body);
    const result = await this.users.update(userId, input, auditContext(request, principal));

    response.status(200).json({
      success: true,
      message: 'Foydalanuvchi ma’lumotlari yangilandi.',
      data: result,
    });
  };

  updateStatus = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { userId } = userIdParamsSchema.parse(request.params);
    const { status } = updateUserStatusSchema.parse(request.body);
    const result = await this.users.updateStatus(
      userId,
      status,
      actorFrom(principal),
      auditContext(request, principal),
    );

    response.status(200).json({
      success: true,
      message: 'Foydalanuvchi holati yangilandi.',
      data: result,
    });
  };

  replaceRoles = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { userId } = userIdParamsSchema.parse(request.params);
    const { roles } = replaceUserRolesSchema.parse(request.body);
    const result = await this.users.replaceRoles(
      userId,
      roles,
      actorFrom(principal),
      auditContext(request, principal),
    );

    response.status(200).json({
      success: true,
      message: 'Foydalanuvchi rollari yangilandi.',
      data: result,
    });
  };

  delete = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { userId } = userIdParamsSchema.parse(request.params);
    deleteUserSchema.parse(request.body);
    await this.users.delete(userId, actorFrom(principal), auditContext(request, principal));

    response.status(200).json({
      success: true,
      message: 'Foydalanuvchi o‘chirildi. Uni keyinroq tiklash mumkin.',
    });
  };

  restore = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { userId } = userIdParamsSchema.parse(request.params);
    const result = await this.users.restore(userId, auditContext(request, principal));

    response.status(200).json({
      success: true,
      message: 'Foydalanuvchi tiklandi va faolsiz holatga o‘tkazildi.',
      data: result,
    });
  };
}
