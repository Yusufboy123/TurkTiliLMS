import 'dotenv/config';
import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65_535).default(5000),
  DATABASE_URL: z.string().startsWith('postgresql://'),
  FRONTEND_URL: z.url().default('http://localhost:5173'),
});

const result = environmentSchema.safeParse(process.env);

if (!result.success) {
  const details = z.prettifyError(result.error);
  throw new Error(`Invalid environment configuration:\n${details}`);
}

export const environment = result.data;
