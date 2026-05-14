# ROYALSTACK Server

Decentralized poker engine with provably fair shuffling, ephemeral Redis state, and permanent Turso history.

## Architecture

```
Frontend (WebSocket + Wallet)
    ↓
Server (Node.js)
├── Auth Layer (WalletConnect)
├── GameStateMachine (in-memory)
├── WebSocket Handler
├── REST API
└── Services:
    ├── Redis (ephemeral game state)
    ├── Turso (persistent history)
    ├── EventListener (blockchain events)
    └── GameEngine (validation, hand evaluation)
```

## Identity Model

- **No user profiles** — wallet address is the identity
- **No signup** — signature-based login only
- **History tracking** — all stats tied to wallet address in Turso

## Setup

### 1. Environment Variables

```bash
cp .env.example .env
```

Fill in:
- `TURSO_CONNECTION_URL` — from turso.tech dashboard
- `TURSO_AUTH_TOKEN` — from turso.tech dashboard
- `REDIS_URL` — from Upstash
- `CONTRACT_ADDRESS` — your deployed contract
- `PROVIDER_RPC_URL` — Mezo testnet RPC
- `ADMIN_ADDRESS` — your wallet for admin operations
- `FRONTEND_URL` — frontend origin for CORS
- `PORT` — server port (default 3002)

### 2. Install Dependencies

```bash
npm install
```

### 3. Initialize Turso Schema

```bash
turso db shell <your-db-name>
< db/schema.sql
```

### 4. Start Server

```bash
npm start
```

## API Endpoints

### Authentication

- `POST /api/auth/nonce` — Get challenge to sign
- `POST /api/auth/verify` — Verify signature and get session token
- `POST /api/auth/logout` — Invalidate session

### Protected Routes (require session token)

- `GET /api/players/:walletAddress/stats` — Player history
- `GET /api/leaderboard` — Top 10 players by winnings
- `GET /api/hand/:handId` — Replay hand (for dispute/audit)
- `GET /api/pools/:poolId` — Pool state
- `GET /api/health` — Server status

## WebSocket Events

### Client → Server

```js
socket.emit('JOIN_POOL', { poolId });
socket.emit('PLAYER_ACTION', { poolId, action: { type, amount } });
socket.emit('LEAVE_POOL', { poolId });
```

### Server → Client

```js
socket.on('POOL_JOINED', { poolId, walletAddress });
socket.on('PLAYER_JOINED', { walletAddress });
socket.on('GAME_STATE_UPDATED', state);
socket.on('PLAYER_ACTION', { playerId, action });
socket.on('TURN_TIMER_TICK', { playerId, remainingSeconds });
socket.on('TURN_TIMER_TIMEOUT', { playerId });
socket.on('HAND_SAVED', { handId });
socket.on('GAME_OVER', { winners, payouts });
```

## Project Structure

```
src/
├── auth/
│   ├── WalletAuthService.js      # Signature verification & sessions
│   └── authMiddleware.js          # Express & WebSocket protection
├── engine/
│   ├── GameStateMachine.js        # Game state progression
│   ├── HandEvaluator.js           # 5-card hand ranking
│   ├── SidePotCalculator.js       # Multi-pot all-in resolution
│   ├── ActionValidator.js         # Action legality checking
│   ├── ShowdownResolver.js        # Winner determination
│   ├── BlindManager.js            # Dealer rotation, blind posting
│   ├── TurnTimer.js               # 30s action countdown
│   └── Deck.js                    # 52-card seeded shuffle
├── oracle/
│   ├── ShuffleOracle.js           # Commit-reveal fairness
│   ├── CommitStore.js             # Redis hash store for commits
│   └── ProofVerifier.js           # Verify shuffle after hand
├── db/
│   ├── TursoClient.js             # Database client
│   ├── HandHistorian.js           # Persist hands & actions
│   ├── schema.sql                 # Database schema
│   └── tursoConfig.js             # DB initialization
├── chain/
│   └── EventListener.js           # Contract event watcher
└── server.js                      # Main server initialization
```

## Data Flow

1. **Login**: Client signs message → Server verifies → Issues session token
2. **Join Pool**: Client calls contract.deposit() → Contract emits event → Server listens → Seats player in Redis
3. **Play Hand**: Client sends action via WebSocket → Server validates → Updates Redis → Broadcasts to players
4. **End Hand**: Server calculates winners → Saves to Turso → Broadcasts results
5. **Query History**: Client requests stats → Server queries Turso → Returns player record

## Implementation Checklist

- [ ] GameStateMachine: implement all TODO methods
- [ ] HandEvaluator: implement hand ranking logic
- [ ] Deck: Fisher-Yates shuffle (already done)
- [ ] BlindManager: blind posting (already done)
- [ ] ActionValidator: action validation (already done)
- [ ] ShowdownResolver: winner calculation (already done)
- [ ] SidePotCalculator: multi-pot logic (already done)
- [ ] TurnTimer: 30s countdown (already done)
- [ ] EventListener: contract event watching
- [ ] ShuffleOracle: commit-reveal implementation
- [ ] CommitStore: Redis storage (already done)
- [ ] ProofVerifier: signature verification (already done)

## Notes

- **No persistent user DB** — all identity is wallet address
- **Stats are read-only from Turso** — no edits allowed
- **All game logic is deterministic** — same seed = same cards
- **Sessions expire in 7 days** — refresh on reconnect
- **Games auto-save to Turso** — 24h history in Redis

## Security

- Signatures required for all actions
- Rate limiting on nonce generation
- Session token refresh on each verify
- No secrets in Redis (only wallet addresses)
- Contract holds all funds (not server)
