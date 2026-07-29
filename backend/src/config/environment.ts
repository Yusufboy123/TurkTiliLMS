import 'dotenv/config';
import { z } from 'zod';

const durationSchema = z
  .string()
  .regex(/^[1-9]\d*[smhd]$/, 'Duration must use a positive value followed by s, m, h, or d.');

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65_535).default(5000),
  DATABASE_URL: z.string().startsWith('postgresql://'),
  FRONTEND_URL: z.url().default('http://localhost:5173'),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32)
    .refine(
      (secret) => !secret.toLowerCase().includes('replace-with'),
      'JWT access secret must be replaced with a strong random value.',
    ),
  JWT_ACCESS_EXPIRES_IN: durationSchema.default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: durationSchema.default('30d'),
  JWT_ISSUER: z.string().trim().min(3).max(100),
  JWT_AUDIENCE: z.string().trim().min(3).max(100),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  AUTH_MAX_FAILED_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
  AUTH_LOCKOUT_MINUTES: z.coerce.number().int().min(1).max(1_440).default(15),
  MEDIA_STORAGE_ROOT: z.string().trim().min(1).default('uploads'),
  MEDIA_MAX_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .max(2_147_483_647)
    .default(262_144_000),
  CERTIFICATE_ARTIFACT_STORAGE_ROOT: z
    .string()
    .trim()
    .min(1)
    .default('private-certificate-artifacts'),
  CERTIFICATE_PDF_MAX_BYTES: z.coerce.number().int().positive().max(10_485_760).default(10_485_760),
  CERTIFICATE_PDF_RENDER_TIMEOUT_MS: z.coerce.number().int().min(100).max(120_000).default(10_000),
});

const result = environmentSchema.safeParse(process.env);

if (!result.success) {
  const details = z.prettifyError(result.error);
  throw new Error(`Invalid environment configuration:\n${details}`);
}

export const environment = result.data;
