import type { CookieOptions, Request, Response } from 'express';
import { AppError } from '../../utils/app-error.js';
import type { AuthenticationResult } from './auth.types.js';

export const BROWSER_AUTH_TRANSPORT_HEADER = 'x-auth-transport';
export const BROWSER_AUTH_TRANSPORT_VALUE = 'cookie';

export interface BrowserSessionConfiguration {
  cookieName: string;
  cookiePath: string;
  cookieSameSite: 'lax' | 'strict';
  cookieSecure: boolean;
}

export type PublicAuthenticationResult = Omit<
  AuthenticationResult,
  'refreshToken' | 'refreshTokenExpiresAt'
>;
export type LegacyAuthenticationResult = Omit<AuthenticationResult, 'refreshTokenExpiresAt'>;

function cookieOptions(
  configuration: BrowserSessionConfiguration,
  refreshTokenExpiresAt?: Date,
): CookieOptions {
  const maxAge =
    refreshTokenExpiresAt === undefined
      ? undefined
      : Math.max(0, refreshTokenExpiresAt.getTime() - Date.now());

  return {
    httpOnly: true,
    secure: configuration.cookieSecure,
    sameSite: configuration.cookieSameSite,
    path: configuration.cookiePath,
    ...(refreshTokenExpiresAt === undefined ? {} : { expires: refreshTokenExpiresAt, maxAge }),
  };
}

function invalidRefreshTokenError(): AppError {
  return new AppError('Sessiyani yangilash ma’lumoti yaroqsiz.', 401, 'INVALID_REFRESH_TOKEN');
}

function bodyRefreshToken(request: Request): string | null {
  if (typeof request.body !== 'object' || request.body === null) return null;
  const value = (request.body as Record<string, unknown>).refreshToken;
  return typeof value === 'string' ? value : null;
}

function cookieValue(request: Request, cookieName: string): string | null {
  const cookieHeader = request.header('cookie');
  if (!cookieHeader) return null;

  let matchedValue: string | null = null;

  for (const item of cookieHeader.split(';')) {
    const separator = item.indexOf('=');
    if (separator < 0) continue;
    const name = item.slice(0, separator).trim();
    if (name !== cookieName) continue;

    if (matchedValue !== null) {
      throw invalidRefreshTokenError();
    }

    const encodedValue = item.slice(separator + 1).trim();
    try {
      matchedValue = decodeURIComponent(encodedValue);
    } catch {
      throw invalidRefreshTokenError();
    }
  }

  return matchedValue;
}

export function authenticationTransport(request: Request): 'cookie' | 'body' {
  const value = request.header(BROWSER_AUTH_TRANSPORT_HEADER);

  if (value === undefined) {
    // Browser JavaScript cannot suppress Origin/Referer reliably. Requiring the
    // explicit cookie transport in that context prevents a trusted web origin
    // from downgrading to a JavaScript-readable legacy refresh credential.
    if (request.header('origin') !== undefined || request.header('referer') !== undefined) {
      throw new AppError(
        'Brauzer so‘rovi cookie autentifikatsiya transportidan foydalanishi kerak.',
        400,
        'INVALID_AUTH_TRANSPORT',
      );
    }

    return 'body';
  }
  if (value === BROWSER_AUTH_TRANSPORT_VALUE) return 'cookie';

  throw new AppError(
    'Autentifikatsiya transporti qo‘llab-quvvatlanmaydi.',
    400,
    'INVALID_AUTH_TRANSPORT',
  );
}

export function isBrowserCookieRequest(request: Request): boolean {
  return request.header(BROWSER_AUTH_TRANSPORT_HEADER) === BROWSER_AUTH_TRANSPORT_VALUE;
}

export function resolveRefreshCredential(
  request: Request,
  configuration: BrowserSessionConfiguration,
): { refreshToken: string; transport: 'cookie' | 'body' } {
  const transport = authenticationTransport(request);
  const cookieToken = cookieValue(request, configuration.cookieName);
  const bodyToken = bodyRefreshToken(request);

  if (cookieToken && bodyToken) {
    throw new AppError(
      'Refresh token faqat bitta transport orqali yuborilishi kerak.',
      400,
      'AMBIGUOUS_REFRESH_TRANSPORT',
    );
  }

  const refreshToken = transport === 'cookie' ? cookieToken : bodyToken;
  if (!refreshToken) {
    throw invalidRefreshTokenError();
  }

  return { refreshToken, transport };
}

export function readBrowserRefreshCredential(
  request: Request,
  configuration: BrowserSessionConfiguration,
): string | null {
  authenticationTransport(request);
  const cookieToken = cookieValue(request, configuration.cookieName);
  const bodyToken = bodyRefreshToken(request);

  if (cookieToken && bodyToken) {
    throw new AppError(
      'Refresh token faqat bitta transport orqali yuborilishi kerak.',
      400,
      'AMBIGUOUS_REFRESH_TRANSPORT',
    );
  }

  return cookieToken;
}

export function setBrowserRefreshCookie(
  response: Response,
  result: AuthenticationResult,
  configuration: BrowserSessionConfiguration,
): void {
  response.cookie(
    configuration.cookieName,
    result.refreshToken,
    cookieOptions(configuration, result.refreshTokenExpiresAt),
  );
}

export function clearBrowserRefreshCookie(
  response: Response,
  configuration: BrowserSessionConfiguration,
): void {
  response.clearCookie(configuration.cookieName, cookieOptions(configuration));
}

export function toPublicAuthenticationResult(
  result: AuthenticationResult,
): PublicAuthenticationResult {
  return {
    accessToken: result.accessToken,
    user: result.user,
    roles: result.roles,
    permissions: result.permissions,
  };
}

export function toLegacyAuthenticationResult(
  result: AuthenticationResult,
): LegacyAuthenticationResult {
  return {
    ...toPublicAuthenticationResult(result),
    refreshToken: result.refreshToken,
  };
}
