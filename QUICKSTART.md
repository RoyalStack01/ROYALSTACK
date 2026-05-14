# Quick Start Guide

Get ROYALSTACK running locally in 5 minutes.

## Prerequisites

- Node.js 18+
- Git
- A wallet (MetaMask recommended)

## 1. Server Setup

```bash
cd server

# Copy environment template
cp .env.example .env

# Fill in the .env file:
# - TURSO_CONNECTION_URL (from turso.tech)
# - TURSO_AUTH_TOKEN (from turso.tech)
# - REDIS_URL (from Upstash)
# - CONTRACT_ADDRESS (your deployed contract)
# - PROVIDER_RPC_URL (Mezo testnet)
nano .env

# Install dependencies
npm install

# Start server
npm start
```

**Expected output:**
```
✓ Redis connected
✓ Turso connected
✓ EventListener connected to contract
✓ EventListener watching contract events
🚀 Server running on port 3002
```

## 2. Frontend Setup

```bash
cd ../client

# Copy environment template
cp .env.example .env

# Fill in:
# VITE_API_URL=http://localhost:3002
# VITE_WS_URL=http://localhost:3002
nano .env

# Install dependencies
npm install

# Start dev server
npm run dev
```

**Expected output:**
```
VITE v5.0.0  ready in 123 ms
➜  Local:   http://localhost:5173/
```

## 3. Test Locally

### Test Authentication

```bash
# Get nonce
curl -X POST http://localhost:3002/api/auth/nonce \
  -H "Content-Type: application/json" \
  -d '{"walletAddress":"0x742d35Cc6634C0532925a3b844Bc9e7595f1e1d2"}'

# Response:
# {
#   "nonce": "abc123...",
#   "message": "ROYALSTACK Login: abc123...",
#   "expiresIn": 300
# }
```

### Test Game Flow

1. Open `http://localhost:5173` in browser
2. Connect wallet (MetaMask testnet)
3. Sign message to authenticate
4. View dashboard & stats
5. Create/join a pool

## 4. Test Contract Integration

### Deploy Contract (Optional)

```bash
# If you haven't deployed yet:
# cd smart-contract
# npx hardhat deploy --network mezo-testnet-31611
```

### Create a Pool

```bash
# Use web3.py or ethers.js to call contract
from web3 import Web3
import json

w3 = Web3(Web3.HTTPProvider("https://mezo-testnet-31611.rpc.io"))

# Call contract.createPool(initialDeposit)
# This should emit PoolCreated event
# EventListener will pick it up and initialize in Redis
```

**Watch server logs:**
```
📍 PoolCreated: poolId=1, creator=0x..., deposit=1000
✓ Pool 1 initialized in Redis
```

### Deposit to Pool

```bash
# Call contract.deposit(poolId, amount)
# This should emit DepositMade event
```

**Watch server logs:**
```
💰 DepositMade: poolId=1, player=0x..., amount=500
🎮 Pool 1 has 1/5 players
```

## 5. Test WebSocket Connection

```javascript
// In browser console:
const client = new RoyalStackClient('http://localhost:3002');

// Restore session from localStorage
client.restoreSession();

// Connect
await client.connectWebSocket();

// Join pool
await client.game.joinPool(1);

// Listen for game updates
client.onGameStateUpdate((state) => {
  console.log('Game state:', state);
});

// Send action
await client.game.sendAction({
  type: 'bet',
  amount: 100
});
```

## 6. Common Issues

### "Connection refused" on Redis
- Check Upstash credentials in `.env`
- Verify REDIS_URL is correct format

### "Turso connection failed"
- Verify `TURSO_CONNECTION_URL` and `TURSO_AUTH_TOKEN`
- Make sure schema was initialized: `turso db shell <name> < db/schema.sql`

### WebSocket auth failing
- Ensure session token is stored in localStorage
- Check that `RoyalStackClient` has called `auth.verify()` first

### Events not being picked up
- Verify `PROVIDER_RPC_URL` is correct for your chain
- Check contract address matches deployment
- Ensure contract ABI matches event signatures

### Game state not updating
- Verify Redis is connected: `redis-cli ping`
- Check GameStateMachine is initialized
- Look for errors in server logs

## 7. Database Inspection

### Query Turso

```bash
turso db shell royalstack

# List tables
.tables

# Check player stats
SELECT * FROM player_stats;

# Check hands history
SELECT * FROM hands WHERE poolId = 1;

# Check actions for a hand
SELECT * FROM actions WHERE handId = 1 ORDER BY sequence;
```

### Query Redis

```bash
redis-cli

# Check active pools
KEYS room:*:state

# Get pool state
HGETALL room:1:state

# Get players in pool
HGETALL room:1:players

# Check sessions
KEYS session:*
```

## 8. Next Steps

- [ ] Read `INTEGRATION_GUIDE.md` for architecture overview
- [ ] Implement missing engine methods (HandEvaluator, etc.)
- [ ] Build frontend UI components
- [ ] Add test suite
- [ ] Deploy to production (see `DEPLOYMENT.md`)

## Useful Commands

```bash
# Server development with auto-reload
npm run dev

# View server logs
npm start 2>&1 | grep "✓\|✗\|error"

# Clear Redis cache
redis-cli FLUSHDB

# Reset database
turso db shell <name> < db/schema.sql

# Check blockchain connectivity
curl https://mezo-testnet-31611.rpc.io \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

## Support

- Server issues: Check `src/server.js` logs
- Contract issues: Check EventListener output
- Frontend issues: Browser DevTools console
- Database issues: Query directly with Turso CLI or redis-cli

Happy playing! 🎰
