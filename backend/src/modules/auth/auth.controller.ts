import { SessionClientType } from '@prisma/client';
import type { Request, Response } from 'express';
import { AppError } from '../../utils/app-error.js';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types.js';
import { changePasswordSchema, loginSchema, refreshSchema } from './auth.schemas.js';
import type { AuthenticationService } from './auth.service.js';
import type { RequestMetadata } from './auth.types.js';

function requestMetadata(
  request: Request,
  clientType: SessionClientType = SessionClientType.WEB,
): RequestMetadata {
  const userAgent = request.header('user-agent')?.slice(0, 2_000);

  return {
    clientType,
    ...(request.ip ? { ipAddress: request.ip } : {}),
    ...(userAgent ? { userAgent } : {}),
  };
}

function authenticatedPrincipal(request: Request): AuthenticatedPrincipal {
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

export class AuthController {
  constructor(private readonly authentication: AuthenticationService) {}

  login = async (request: Request, response: Response): Promise<void> => {
    const input = loginSchema.parse(request.body);
    const result = await this.authentication.login(
      input,
      requestMetadata(request, input.clientType),
    );

    response.status(200).json({
      success: true,
      message: 'Tizimga muvaffaqiyatli kirildi.',
      data: result,
    });
  };

  refresh = async (request: Request, response: Response): Promise<void> => {
    const input = refreshSchema.parse(request.body);
    const result = await this.authentication.refresh(input, requestMetadata(request));

    response.status(200).json({
      success: true,
      message: 'Sessiya muvaffaqiyatli yangilandi.',
      data: result,
    });
  };

  logout = async (request: Request, response: Response): Promise<void> => {
    const principal = authenticatedPrincipal(request);
    await this.authentication.logout(
      principal.userId,
      principal.sessionId,
      requestMetadata(request, principal.clientType),
    );

    response.status(200).json({
      success: true,
      message: 'Tizimdan muvaffaqiyatli chiqildi.',
    });
  };

  logoutAll = async (request: Request, response: Response): Promise<void> => {
    const principal = authenticatedPrincipal(request);
    await this.authentication.logoutAll(
      principal.userId,
      requestMetadata(request, principal.clientType),
    );

    response.status(200).json({
      success: true,
      message: 'Barcha qurilmalardagi sessiyalar yopildi.',
    });
  };

  me = async (request: Request, response: Response): Promise<void> => {
    const principal = authenticatedPrincipal(request);
    const result = await this.authentication.getCurrentUser(principal.userId);

    response.status(200).json({
      success: true,
      message: 'Foydalanuvchi ma’lumotlari olindi.',
      data: result,
    });
  };

  changePassword = async (request: Request, response: Response): Promise<void> => {
    const principal = authenticatedPrincipal(request);
    const input = changePasswordSchema.parse(request.body);
    await this.authentication.changePassword(
      principal.userId,
      principal.sessionId,
      input,
      requestMetadata(request, principal.clientType),
    );

    response.status(200).json({
      success: true,
      message: 'Parol muvaffaqiyatli yangilandi.',
    });
  };
}
