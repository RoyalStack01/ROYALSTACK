import { z } from 'zod';

// Empty strings from .env become undefined so optional() works correctly
const optionalStr = (schema) => z.preprocess(v => (v === '' ? undefined : v), schema.optional());

const schema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3002),

  // Turso database
  TURSO_CONNECTION_URL: z.string().url(),
  TURSO_AUTH_TOKEN: z.string().min(1),

  // Redis connection string e.g. rediss://default:token@host:6379
  REDIS_URL: z.string().url(),

  // Mezo EVM JSON-RPC endpoint — optional, mezo.config.js has hardcoded fallback
  RPC_URL: optionalStr(z.string().url()),

  // Deployed pool contract address — optional so server boots without it configured
  POOL_CONTRACT_ADDRESS: optionalStr(z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'POOL_CONTRACT_ADDRESS must be a valid EVM address')),

  // Alias used in server.js — optional, falls back to POOL_CONTRACT_ADDRESS
  CONTRACT_ADDRESS: optionalStr(z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'CONTRACT_ADDRESS must be a valid EVM address')),

  // Allowed CORS origin for the frontend
  FRONTEND_URL: z.preprocess(v => (v === '' ? undefined : v), z.string().url().default('http://localhost:3000')),

  // JWT secret for socket auth signatures (min 32 chars) — required in production
  JWT_SECRET: optionalStr(z.string()),

  // Admin EOA private key — hex with 0x prefix, only required for admin wallet ops
  ADMIN_PRIVATE_KEY: optionalStr(z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'ADMIN_PRIVATE_KEY must be a 0x-prefixed 64-char hex string')),

  // Admin wallet address for role checks
  ADMIN_ADDRESS: optionalStr(z.string().regex(/^0x[0-9a-fA-F]{40}$/)),
});

const _parsed = schema.safeParse(process.env);

if (!_parsed.success) {
  const issues = _parsed.error.issues
    .map(i => `  ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(`Invalid environment variables:\n${issues}`);
}

const env = _parsed.data;

// Warn in production if critical secrets are missing
if (env.NODE_ENV === 'production') {
  const missing = [];
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) missing.push('JWT_SECRET (min 32 chars)');
  if (!env.ADMIN_PRIVATE_KEY) missing.push('ADMIN_PRIVATE_KEY');
  if (missing.length > 0) {
    console.warn(`⚠ Missing production secrets: ${missing.join(', ')}`);
  }
}

export default env;
