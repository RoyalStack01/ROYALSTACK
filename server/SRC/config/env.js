import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // Admin EOA private key — hex with 0x prefix
  ADMIN_PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'ADMIN_PRIVATE_KEY must be a 0x-prefixed 64-char hex string'),

  // ioredis connection string e.g. redis://localhost:6379
  REDIS_URL: z.string().url(),

  // Mezo EVM JSON-RPC endpoint
  RPC_URL: z.string().url(),

  // Deployed pool contract address
  POOL_CONTRACT_ADDRESS: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'POOL_CONTRACT_ADDRESS must be a valid EVM address'),

  // Allowed CORS origin for the frontend
  FRONTEND_URL: z.string().url(),

  // JWT secret for socket auth signatures (min 32 chars)
  JWT_SECRET: z.string().min(32),
});

const _parsed = schema.safeParse(process.env);

if (!_parsed.success) {
  const issues = _parsed.error.issues
    .map(i => `  ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(`Invalid environment variables:\n${issues}`);
}

export default _parsed.data;
