import 'dotenv/config';
import { z } from 'zod';

const durationSchema = z
  .string()
  .regex(/^[1-9]\d*[smhd]$/, 'Duration must use a positive value followed by s, m, h, or d.');

const frontendOriginSchema = z.url().refine((value) => new URL(value).origin === value, {
  message: 'FRONTEND_URL must be an origin without a path, query, or fragment.',
});
const frontendOriginsSchema = z.string().trim().optional().superRefine((value, context) => {
  if (!value) return;
  for (const origin of value.split(',').map((item) => item.trim()).filter(Boolean)) {
    const result = frontendOriginSchema.safeParse(origin);
    if (!result.success) {
      context.addIssue({
        code: 'custom',
        message: `Invalid frontend origin: ${origin}`,
      });
    }
  }
});
const refreshCookiePath = '/api/v1/auth' as const;
const minimumProductionJwtSecretLength = 43;

const jwtSecretPlaceholderFragments = [
  'replace-with',
  'change-me',
  'changeme',
  'your-secret',
  'default-secret',
  'example-secret',
] as const;

function containsJwtSecretPlaceholder(secret: string): boolean {
  const normalized = secret.toLowerCase();
  return jwtSecretPlaceholderFragments.some((fragment) => normalized.includes(fragment));
}

function isRepeatedJwtSecret(secret: string): boolean {
  for (let chunkLength = 1; chunkLength <= 8; chunkLength += 1) {
    if (secret.length % chunkLength !== 0) continue;
    const chunk = secret.slice(0, chunkLength);
    if (chunk.repeat(secret.length / chunkLength) === secret) return true;
  }
  return false;
}

function isLowEntropyJwtSecret(secret: string): boolean {
  return isRepeatedJwtSecret(secret) || new Set(secret).size < 8;
}

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    HOST: z.string().trim().min(1).default('0.0.0.0'),
    PORT: z.coerce.number().int().positive().max(65_535).default(5000),
    DATABASE_URL: z.string().startsWith('postgresql://'),
    FRONTEND_URL: frontendOriginSchema.default('http://localhost:5173'),
    FRONTEND_URLS: frontendOriginsSchema,
    JWT_ACCESS_SECRET: z
      .string()
      .min(32)
      .refine((secret) => !containsJwtSecretPlaceholder(secret), 'JWT access secret must not use a placeholder value.')
      .refine((secret) => !isLowEntropyJwtSecret(secret), 'JWT access secret must not use a repeated or low-entropy value.'),
    JWT_ACCESS_EXPIRES_IN: durationSchema.default('15m'),
    REFRESH_TOKEN_EXPIRES_IN: durationSchema.default('30d'),
    JWT_ISSUER: z.string().trim().min(3).max(100),
    JWT_AUDIENCE: z.string().trim().min(3).max(100),
    BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
    AUTH_MAX_FAILED_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
    AUTH_LOCKOUT_MINUTES: z.coerce.number().int().min(1).max(1_440).default(15),
    AUTH_REFRESH_COOKIE_NAME: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,64}$/)
      .default('turk_tili_refresh'),
    AUTH_REFRESH_COOKIE_SECURE: z.enum(['true', 'false']).optional(),
    AUTH_REFRESH_COOKIE_SAME_SITE: z.enum(['lax', 'strict']).default('lax'),
    AUTH_REFRESH_COOKIE_PATH: z.literal(refreshCookiePath).default(refreshCookiePath),
    MEDIA_STORAGE_ROOT: z.string().trim().min(1).default('uploads'),
    MEDIA_MAX_UPLOAD_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .max(2_147_483_647)
      .default(262_144_000),
    MEDIA_USER_STORAGE_QUOTA_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .max(Number.MAX_SAFE_INTEGER)
      .default(5_368_709_120),
    CERTIFICATE_ARTIFACT_STORAGE_ROOT: z
      .string()
      .trim()
      .min(1)
      .default('private-certificate-artifacts'),
    CERTIFICATE_PDF_MAX_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .max(10_485_760)
      .default(10_485_760),
    CERTIFICATE_PDF_RENDER_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(100)
      .max(120_000)
      .default(10_000),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === 'production' && value.AUTH_REFRESH_COOKIE_SECURE === 'false') {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_REFRESH_COOKIE_SECURE'],
        message: 'The refresh cookie must be Secure in production.',
      });
    }

    const additionalFrontendOrigins = (value.FRONTEND_URLS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);

    if (value.NODE_ENV === 'production' && new URL(value.FRONTEND_URL).protocol !== 'https:') {
      context.addIssue({
        code: 'custom',
        path: ['FRONTEND_URL'],
        message: 'FRONTEND_URL must use HTTPS in production.',
      });
    }

    if (
      value.NODE_ENV === 'production' &&
      additionalFrontendOrigins.some((origin) => new URL(origin).protocol !== 'https:')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['FRONTEND_URLS'],
        message: 'FRONTEND_URLS must use HTTPS in production.',
      });
    }

    if (value.NODE_ENV === 'production' && value.JWT_ACCESS_SECRET.length < minimumProductionJwtSecretLength) {
      context.addIssue({
        code: 'too_small',
        minimum: minimumProductionJwtSecretLength,
        inclusive: true,
        origin: 'string',
        path: ['JWT_ACCESS_SECRET'],
        message: 'JWT access secret must be at least 43 characters in production.',
      });
    }

    if (value.NODE_ENV === 'production' && new Set(value.JWT_ACCESS_SECRET).size < 16) {
      context.addIssue({
        code: 'custom',
        path: ['JWT_ACCESS_SECRET'],
        message: 'JWT access secret must contain sufficient character diversity in production.',
      });
    }
  });

export function parseEnvironment(input: Record<string, string | undefined>) {
  const result = environmentSchema.safeParse(input);

  if (!result.success) {
    const details = z.prettifyError(result.error);
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return {
    ...result.data,
    FRONTEND_ORIGINS: new Set([
      result.data.FRONTEND_URL,
      ...(result.data.FRONTEND_URLS ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ]),
    AUTH_REFRESH_COOKIE_SECURE:
      result.data.AUTH_REFRESH_COOKIE_SECURE === undefined
        ? result.data.NODE_ENV === 'production'
        : result.data.AUTH_REFRESH_COOKIE_SECURE === 'true',
  };
}

export const environment = parseEnvironment(process.env);
