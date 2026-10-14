import 'dotenv/config';
import { z } from 'zod';
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1).optional(),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(16).default('development-jwt-super-secret-key-32chars!'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  MAIL_DRIVER: z.enum(['log', 'smtp']).default('log'),
});
export function loadEnv(source = process.env) { return schema.parse(source); }
