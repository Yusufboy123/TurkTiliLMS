import type { RequestHandler } from 'express';
import type { CorsOptions } from 'cors';
import { AppError } from '../utils/app-error.js';

const UNTRUSTED_ORIGIN_MESSAGE = 'So‘rov yuborilgan manbaga ruxsat berilmagan.';

export function createCredentialedCorsOptions(trustedOrigins: ReadonlySet<string>): CorsOptions {
  return {
    origin(origin, callback) {
      callback(null, origin === undefined || trustedOrigins.has(origin));
    },
    credentials: true,
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'Idempotency-Key',
      'X-Auth-Transport',
      'X-Request-ID',
      'X-Step-Up-Proof',
    ],
  };
}

export function isTrustedOrigin(value: string, trustedOrigins: ReadonlySet<string>): boolean {
  try {
    return trustedOrigins.has(new URL(value).origin) && new URL(value).origin === value;
  } catch {
    return false;
  }
}

export function createRejectUntrustedOrigin(trustedOrigins: ReadonlySet<string>): RequestHandler {
  return (request, _response, next) => {
    const origin = request.header('origin');

    if (origin && !isTrustedOrigin(origin, trustedOrigins)) {
      next(new AppError(UNTRUSTED_ORIGIN_MESSAGE, 403, 'UNTRUSTED_ORIGIN'));
      return;
    }

    next();
  };
}

export function createRequireTrustedBrowserOrigin(
  trustedOrigins: ReadonlySet<string>,
  isBrowserCookieRequest: (request: Parameters<RequestHandler>[0]) => boolean,
): RequestHandler {
  return (request, _response, next) => {
    if (!isBrowserCookieRequest(request)) {
      next();
      return;
    }

    const origin = request.header('origin');
    const referer = request.header('referer');
    const trusted =
      (origin !== undefined && isTrustedOrigin(origin, trustedOrigins)) ||
      (origin === undefined &&
        referer !== undefined &&
        (() => {
          try {
            return trustedOrigins.has(new URL(referer).origin);
          } catch {
            return false;
          }
        })());

    if (!trusted) {
      next(new AppError(UNTRUSTED_ORIGIN_MESSAGE, 403, 'UNTRUSTED_ORIGIN'));
      return;
    }

    next();
  };
}
