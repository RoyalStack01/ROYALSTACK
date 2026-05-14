# ROYALSTACK Deployment & Monitoring

Production checklist and best practices for deploying the server and frontend.

## Server Deployment

### 1. Environment Setup (Production)

**Create `.env.production`:**

```bash
# Database
TURSO_CONNECTION_URL=libsql://royalstack-db-xxxx.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOiJFZEdTNTEyIn0...

# Cache
REDIS_URL=redis://default:your-token@your-cluster.upstash.io:6379

# Blockchain
CONTRACT_ADDRESS=0x1234...
PROVIDER_RPC_URL=https://mezo-testnet-31611.rpc.io

# Admin
ADMIN_ADDRESS=0x5678...

# Server
PORT=3002
NODE_ENV=production
LOG_LEVEL=info

# Frontend CORS
FRONTEND_URL=https://royalstack.io
```

### 2. Deploy Options

#### Option A: Railway.app (Recommended)

```bash
# 1. Install Railway CLI
npm install -g railway

# 2. Login and link project
railway login
railway link

# 3. Deploy
railway up

# 4. View logs
railway logs
```

#### Option B: Heroku

```bash
# 1. Create app
heroku create royalstack-server

# 2. Set environment variables
heroku config:set TURSO_CONNECTION_URL=...
heroku config:set REDIS_URL=...
heroku config:set CONTRACT_ADDRESS=...
heroku config:set PROVIDER_RPC_URL=...

# 3. Deploy
git push heroku main

# 4. View logs
heroku logs --tail
```

#### Option C: Docker (Self-hosted)

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package.json .
RUN npm install --production

COPY src ./src
COPY db ./db

EXPOSE 3002

CMD ["node", "src/server.js"]
```

```bash
# Build
docker build -t royalstack-server .

# Run
docker run -p 3002:3002 \
  -e TURSO_CONNECTION_URL=... \
  -e REDIS_URL=... \
  -e CONTRACT_ADDRESS=... \
  -e PROVIDER_RPC_URL=... \
  royalstack-server
```

### 3. Health Checks

```bash
# Check server status
curl http://localhost:3002/api/health

# Response:
# { "status": "ok" }
```

Add to deployment health checks:

```
HTTP GET /api/health
Expected: 200 OK
Interval: 30s
Timeout: 5s
```

---

## Monitoring & Logging

### 1. Server Health Monitoring

**Create `src/monitoring/health.js`:**

```js
export async function checkHealth(tursoClient, redisClient, eventListener) {
  const checks = {
    timestamp: Date.now(),
    redis: await redisClient.ping(),
    turso: await tursoClient.ping(),
    blockchain: await eventListener.ping(),
  };

  return {
    status: Object.values(checks).every(c => c) ? 'healthy' : 'degraded',
    checks,
  };
}
```

Add to server:
```js
app.get('/api/health', async (req, res) => {
  const health = await checkHealth(tursoClient, redisClient, eventListener);
  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});
```

### 2. Logging

**Add structured logging:**

```bash
npm install winston
```

```js
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Use in EventListener, GameStateMachine, etc.
logger.info('Event received', { poolId, eventType: 'DepositMade' });
```

### 3. Monitoring Tools

**Option A: Uptime Robot (Free)**

```
Monitor URL: https://royalstack-server.example.com/api/health
Check Interval: Every 5 minutes
Notification: Email on down
```

**Option B: Datadog (Production)**

```
npm install dd-trace
```

```js
import tracer from 'dd-trace';
tracer.init();

export async function initializeServer() {
  // ... rest of initialization
}
```

**Option C: New Relic**

```bash
npm install newrelic
```

Create `newrelic.js`:
```js
exports.config = {
  app_name: ['ROYALSTACK'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  logging: { level: 'info' },
};
```

Add to top of `src/server.js`:
```js
import 'newrelic';
```

### 4. Error Tracking (Sentry)

```bash
npm install @sentry/node
```

```js
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

app.use(Sentry.Handlers.errorHandler());
```

---

## Frontend Deployment

### 1. Build for Production

```bash
npm run build
```

### 2. Deploy to Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod

# Environment variables
vercel env add VITE_API_URL=https://royalstack-server.example.com
```

### 3. Deploy to Netlify

```bash
# Install CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist
```

### 4. Deploy to AWS S3 + CloudFront

```bash
# Build
npm run build

# Deploy to S3
aws s3 sync dist/ s3://royalstack-frontend --delete

# Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id E12345EXAMPLE \
  --paths "/*"
```

### 5. Environment Variables (Frontend)

**.env.production:**

```
VITE_API_URL=https://api.royalstack.io
VITE_WS_URL=https://api.royalstack.io
VITE_CONTRACT_ADDRESS=0x...
VITE_CHAIN_ID=31611
```

---

## Database Backups

### Turso Backups (Automatic)

```bash
# List backups
turso db list backups <db-name>

# Restore from backup
turso db restore <db-name> <backup-id>
```

### Redis Backups (Upstash)

Upstash automatically backs up Redis every hour.

```bash
# In Upstash dashboard: Data Import/Export → Export
# Download RDB file
```

---

## Performance Optimization

### 1. Redis Optimization

```bash
# Monitor Redis
redis-cli INFO stats

# Check memory usage
redis-cli INFO memory

# Optimize key eviction
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### 2. Database Optimization

```sql
-- Analyze query performance
EXPLAIN QUERY PLAN SELECT ... FROM hands WHERE poolId = 1;

-- Create indexes if needed
CREATE INDEX idx_hands_timestamp ON hands(timestamp DESC);
CREATE INDEX idx_actions_playerId ON actions(playerId);
```

### 3. Server Optimization

```bash
# Enable gzip compression
npm install compression
```

```js
import compression from 'compression';
app.use(compression());
```

---

## Scaling Checklist

- [ ] Redis cluster (Upstash Pro)
- [ ] Turso replication for read scaling
- [ ] Server auto-scaling (Railway, Heroku, AWS)
- [ ] CDN for frontend (Cloudflare, Netlify)
- [ ] Load balancing for multiple server instances
- [ ] Session persistence across servers (store sessions in Redis)

---

## Incident Response

### Server Down
1. Check `/api/health` endpoint
2. View logs in deployment platform
3. Check Redis and Turso connectivity
4. Verify blockchain RPC is accessible
5. Restart server if needed

### High Latency
1. Check Redis/Turso load
2. Monitor EventListener for stuck events
3. Check blockchain RPC response times
4. Scale Redis/Turso if needed

### Game State Corruption
1. Query Turso for hand history
2. Replay hand from `actions` table
3. Compare calculated vs stored state
4. Refund players if needed

---

## Monitoring Dashboard

Create a simple monitoring dashboard at `/admin/dashboard`:

```js
app.get('/admin/dashboard', async (req, res) => {
  const health = await checkHealth(tursoClient, redisClient, eventListener);
  const stats = {
    activeGames: await redisClient.keys('room:*:state').length,
    totalPlayers: (await redisClient.keys('room:*:players')).length,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };

  res.json({ health, stats });
});
```

---

## Go-Live Checklist

- [ ] All env vars configured in production
- [ ] SSL certificates installed
- [ ] Database backups enabled
- [ ] Monitoring & alerting set up
- [ ] Error tracking (Sentry) enabled
- [ ] Rate limiting configured
- [ ] CORS properly restricted
- [ ] Admin endpoints protected
- [ ] Load tested with concurrent players
- [ ] Disaster recovery plan documented
