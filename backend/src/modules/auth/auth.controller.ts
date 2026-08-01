import { SessionClientType } from '@prisma/client';
import type { Request, Response } from 'express';
import { AppError } from '../../utils/app-error.js';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types.js';
import { changePasswordSchema, loginSchema, refreshSchema } from './auth.schemas.js';
import type { AuthenticationService } from './auth.service.js';
import type { RequestMetadata } from './auth.types.js';
import {
  authenticationTransport,
  clearBrowserRefreshCookie,
  readBrowserRefreshCredential,
  resolveRefreshCredential,
  setBrowserRefreshCookie,
  toLegacyAuthenticationResult,
  toPublicAuthenticationResult,
  type BrowserSessionConfiguration,
} from './browser-session-transport.js';

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
  constructor(
    private readonly authentication: AuthenticationService,
    private readonly browserSession: BrowserSessionConfiguration,
  ) {}

  login = async (request: Request, response: Response): Promise<void> => {
    const transport = authenticationTransport(request);
    const input = loginSchema.parse(request.body);

    if (transport === 'cookie' && input.clientType !== SessionClientType.WEB) {
      throw new AppError(
        'Cookie transporti faqat WEB mijozlari uchun ishlatiladi.',
        400,
        'INVALID_AUTH_TRANSPORT',
      );
    }

    const result = await this.authentication.login(
      input,
      requestMetadata(request, input.clientType),
    );

    if (transport === 'cookie') {
      setBrowserRefreshCookie(response, result, this.browserSession);
    }

    response.status(200).json({
      success: true,
      message: 'Tizimga muvaffaqiyatli kirildi.',
      data:
        transport === 'cookie'
          ? toPublicAuthenticationResult(result)
          : toLegacyAuthenticationResult(result),
    });
  };

  refresh = async (request: Request, response: Response): Promise<void> => {
    const transport = authenticationTransport(request);

    try {
      const credential = resolveRefreshCredential(request, this.browserSession);
      const input = refreshSchema.parse({ refreshToken: credential.refreshToken });
      const result = await this.authentication.refresh(input, requestMetadata(request));

      if (credential.transport === 'cookie') {
        setBrowserRefreshCookie(response, result, this.browserSession);
      }

      response.status(200).json({
        success: true,
        message: 'Sessiya muvaffaqiyatli yangilandi.',
        data:
          credential.transport === 'cookie'
            ? toPublicAuthenticationResult(result)
            : toLegacyAuthenticationResult(result),
      });
    } catch (error: unknown) {
      if (
        transport === 'cookie' &&
        error instanceof AppError &&
        error.code === 'INVALID_REFRESH_TOKEN'
      ) {
        clearBrowserRefreshCookie(response, this.browserSession);
      }
      throw error;
    }
  };

  logout = async (request: Request, response: Response): Promise<void> => {
    const transport = authenticationTransport(request);

    if (transport === 'cookie') {
      try {
        const refreshToken = readBrowserRefreshCredential(request, this.browserSession);
        if (refreshToken) {
          await this.authentication.logoutByRefreshToken(refreshToken, requestMetadata(request));
        }
      } finally {
        clearBrowserRefreshCookie(response, this.browserSession);
      }
    } else {
      const principal = authenticatedPrincipal(request);
      await this.authentication.logout(
        principal.userId,
        principal.sessionId,
        requestMetadata(request, principal.clientType),
      );
    }

    response.status(200).json({
      success: true,
      message: 'Tizimdan muvaffaqiyatli chiqildi.',
    });
  };

  logoutAll = async (request: Request, response: Response): Promise<void> => {
    const transport = authenticationTransport(request);
    const principal = authenticatedPrincipal(request);
    await this.authentication.logoutAll(
      principal.userId,
      requestMetadata(request, principal.clientType),
    );

    if (transport === 'cookie') {
      clearBrowserRefreshCookie(response, this.browserSession);
    }

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
