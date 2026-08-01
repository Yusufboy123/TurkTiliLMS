import type { SignOptions } from 'jsonwebtoken';
import { environment } from '../../config/environment.js';
import { PrismaUserRepository } from '../users/user.repository.js';
import { PrismaAuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import type { BrowserSessionConfiguration } from './browser-session-transport.js';
import { BcryptPasswordService } from './password.service.js';
import { CryptoRefreshTokenService } from './refresh-token.service.js';
import { JwtAccessTokenService, durationToMilliseconds } from './token.service.js';

export const accessTokenService = new JwtAccessTokenService({
  secret: environment.JWT_ACCESS_SECRET,
  expiresIn: environment.JWT_ACCESS_EXPIRES_IN as NonNullable<SignOptions['expiresIn']>,
  issuer: environment.JWT_ISSUER,
  audience: environment.JWT_AUDIENCE,
});

export const passwordService = new BcryptPasswordService(environment.BCRYPT_ROUNDS);
export const refreshTokenService = new CryptoRefreshTokenService();
export const browserSessionConfiguration: BrowserSessionConfiguration = {
  cookieName: environment.AUTH_REFRESH_COOKIE_NAME,
  cookiePath: environment.AUTH_REFRESH_COOKIE_PATH,
  cookieSameSite: environment.AUTH_REFRESH_COOKIE_SAME_SITE,
  cookieSecure: environment.AUTH_REFRESH_COOKIE_SECURE,
};

export const authenticationService = new AuthService(
  new PrismaUserRepository(),
  new PrismaAuthRepository(),
  passwordService,
  accessTokenService,
  refreshTokenService,
  {
    refreshTokenExpiresInMs: durationToMilliseconds(environment.REFRESH_TOKEN_EXPIRES_IN),
    maximumFailedAttempts: environment.AUTH_MAX_FAILED_ATTEMPTS,
    lockoutDurationMs: environment.AUTH_LOCKOUT_MINUTES * 60_000,
  },
);
