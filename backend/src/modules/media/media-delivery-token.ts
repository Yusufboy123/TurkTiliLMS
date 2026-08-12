import { createHmac, timingSafeEqual } from 'node:crypto';

const tokenLifetimeSeconds = 300;

export interface MediaDeliveryClaims {
  mediaId: string;
  userId: string;
  expiresAt: number;
}

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export class MediaDeliveryTokenService {
  constructor(private readonly secret: string) {}

  create(mediaId: string, userId: string, now = Math.floor(Date.now() / 1_000)): { token: string; expiresAt: number } {
    const claims: MediaDeliveryClaims = { mediaId, userId, expiresAt: now + tokenLifetimeSeconds };
    const payload = encode(JSON.stringify(claims));
    return { token: `${payload}.${signPayload(payload, this.secret)}`, expiresAt: claims.expiresAt };
  }

  verify(token: string, now = Math.floor(Date.now() / 1_000)): MediaDeliveryClaims | null {
    const [payload, signature, ...extra] = token.split('.');
    if (!payload || !signature || extra.length > 0) return null;
    const expected = signPayload(payload, this.secret);
    const providedBytes = Buffer.from(signature, 'base64url');
    const expectedBytes = Buffer.from(expected, 'base64url');
    if (providedBytes.length !== expectedBytes.length || !timingSafeEqual(providedBytes, expectedBytes)) return null;
    try {
      const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<MediaDeliveryClaims>;
      if (typeof claims.mediaId !== 'string' || typeof claims.userId !== 'string' || typeof claims.expiresAt !== 'number') return null;
      if (!Number.isSafeInteger(claims.expiresAt) || claims.expiresAt <= now) return null;
      return claims as MediaDeliveryClaims;
    } catch {
      return null;
    }
  }
}

export const MEDIA_DELIVERY_TOKEN_TTL_SECONDS = tokenLifetimeSeconds;
