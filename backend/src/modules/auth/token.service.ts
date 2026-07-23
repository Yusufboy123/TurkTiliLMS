import type { RoleCode } from '@prisma/client';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import { AppError } from '../../utils/app-error.js';
import type { AccessTokenClaims, AccessTokenService } from './auth.types.js';

const accessTokenPayloadSchema = z.object({
  sub: z.uuid(),
  sessionId: z.uuid(),
  roles: z.array(z.enum(['ADMIN', 'TEACHER', 'STUDENT'])),
});

export interface JwtAccessTokenConfiguration {
  secret: string;
  expiresIn: NonNullable<SignOptions['expiresIn']>;
  issuer: string;
  audience: string;
}

export class JwtAccessTokenService implements AccessTokenService {
  constructor(private readonly configuration: JwtAccessTokenConfiguration) {}

  sign(claims: AccessTokenClaims): string {
    return jwt.sign(
      {
        sessionId: claims.sessionId,
        roles: claims.roles,
      },
      this.configuration.secret,
      {
        algorithm: 'HS256',
        subject: claims.sub,
        issuer: this.configuration.issuer,
        audience: this.configuration.audience,
        expiresIn: this.configuration.expiresIn,
      },
    );
  }

  verify(token: string): AccessTokenClaims {
    let decoded: string | JwtPayload;

    try {
      decoded = jwt.verify(token, this.configuration.secret, {
        algorithms: ['HS256'],
        issuer: this.configuration.issuer,
        audience: this.configuration.audience,
      });
    } catch {
      throw new AppError(
        'Kirish sessiyasi yaroqsiz yoki muddati tugagan.',
        401,
        'INVALID_ACCESS_TOKEN',
      );
    }

    if (typeof decoded === 'string') {
      throw new AppError(
        'Kirish sessiyasi yaroqsiz yoki muddati tugagan.',
        401,
        'INVALID_ACCESS_TOKEN',
      );
    }

    const result = accessTokenPayloadSchema.safeParse(decoded);

    if (!result.success) {
      throw new AppError(
        'Kirish sessiyasi yaroqsiz yoki muddati tugagan.',
        401,
        'INVALID_ACCESS_TOKEN',
      );
    }

    return {
      sub: result.data.sub,
      sessionId: result.data.sessionId,
      roles: result.data.roles as RoleCode[],
    };
  }
}

export function durationToMilliseconds(duration: string): number {
  const match = /^([1-9]\d*)([smhd])$/.exec(duration);

  if (!match) {
    throw new Error(`Unsupported duration value: ${duration}`);
  }

  const amountText = match[1];
  const unit = match[2];

  if (!amountText || !unit) {
    throw new Error(`Unsupported duration value: ${duration}`);
  }

  const amount = Number(amountText);
  const multiplier = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  }[unit];

  if (multiplier === undefined) {
    throw new Error(`Unsupported duration unit: ${unit}`);
  }

  return amount * multiplier;
}
