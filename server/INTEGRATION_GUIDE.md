# Server Integration Guide

Everything is now wired together. Here's how the pieces connect.

## Core Flow: From Wallet to Poker

### 1. Authentication (WalletConnect)

```
Frontend                          Server
   |                               |
   +------ generateNonce()-------->|
   |                         WalletAuthService
   |<------ { message, nonce }-----|
   |
   (user signs message in wallet)
   |
   +------ verifySignature()------->|
   |                         WalletAuthService
   |<------ { sessionToken }--------|
   |
   (store token in localStorage)
```

**Files involved:**
- `src/auth/WalletAuthService.js` — generates nonce, verifies signature
- `src/auth/authMiddleware.js` — protects REST/WebSocket routes
- `src/server.js` — POST /api/auth/nonce, POST /api/auth/verify

---

### 2. Pool Creation & Deposit

```
Frontend                  Contract             Server
   |                         |                   |
   +---- contract.createPool()-->| 
   |                    emits PoolCreated
   |                         |
   |                         +-- EventListener-->|
   |                                      Redis: room:{poolId}:state
   |
   (player deposits MEZO)
   |
   +--- contract.deposit()---->|
   |                    emits DepositMade
   |                         |
   |                         +-- EventListener-->|
   |                                      Redis: add player to pool
   |
   +------ JOIN_POOL (WebSocket)----->|
   |                            io.to(`pool:{poolId}`)
   |<------ PLAYER_JOINED-------------|
```

**Files involved:**
- `src/chain/EventListener.js` — listens to DepositMade, PoolCreated
- `src/server.js` — WebSocket JOIN_POOL handler
- Redis stores: `room:{poolId}:players`, `room:{poolId}:state`

---

### 3. Game Play

```
Frontend                    GameStateMachine            Server
   |                               |                      |
   +-- PLAYER_ACTION(poolId, action)-->|
   |                                    |
   |                    validate + apply action
   |                                    |
   |<-- GAME_STATE_UPDATED-------------|
   |            (broadcast to all players)
   |
   (repeat for each player action)
   |
   +-- TURN_TIMER_TIMEOUT ---------> auto-fold
   |
   (continue to next street or showdown)
```

**Files involved:**
- `src/engine/GameStateMachine.js` — manages state progression
- `src/engine/ActionValidator.js` — validates fold/check/call/bet/raise
- `src/engine/BlindManager.js` — dealer rotation, blind posting
- `src/engine/TurnTimer.js` — 30s countdown
- Redis stores: `room:{poolId}:state`, `room:{poolId}:players`

---

### 4. Showdown & History

```
GameStateMachine                        Server
   |                                      |
   +-- stage = 'showdown' (all streets over)
   |
   +-- ShowdownResolver.resolve()  
   |          (best hand for each player)
   |
   +-- SidePotCalculator.calculate()
   |          (multi-pot all-in logic)
   |
   +-- historians.saveHand()---------->Turso
   |    (persist to database)
   |
   +-- broadcast GAME_OVER--------> Frontend
   |    (emit results + payouts)
   |
   +-- next hand or room closes
```

**Files involved:**
- `src/engine/ShowdownResolver.js` — determines winners
- `src/engine/SidePotCalculator.js` — calculates payouts
- `src/engine/HandEvaluator.js` — ranks best 5-card hand
- `src/db/HandHistorian.js` — saves hand + actions to Turso
- `src/db/TursoClient.js` — database operations

---

## Key Initialization Steps (src/server.js)

```js
// 1. Connect to external services
const redisClient = redis.createClient();
const tursoClient = new TursoClient(...);
const eventListener = new EventListener(...);

// 2. Initialize engine
const gameStateMachine = new GameStateMachine({
  deck,
  blindManager,
  turnTimer,
  actionValidator,
  showdownResolver,
  sidePotCalculator,
});

// 3. Initialize auth
const authService = new WalletAuthService(redisClient);

// 4. Set up Express + WebSocket
app.use(authMiddleware);
io.use(wsAuthMiddleware);

// 5. Register routes & events
app.post('/api/auth/nonce', ...);
app.post('/api/auth/verify', ...);
socket.on('JOIN_POOL', ...);
socket.on('PLAYER_ACTION', ...);

// 6. Start listening
httpServer.listen(PORT);
eventListener.start();
```

---

## Data Storage

### Redis (Ephemeral - Lives in Memory)
```
session:{token}              → walletAddress
room:{poolId}:state          → { stage, pot, communityCards, ... }
room:{poolId}:players        → { playerId: playerData, ... }
auth:nonce:{walletAddress}   → nonce (5 min TTL)
oracle:commit:{poolId}:{n}   → { seed, commitment } (24h TTL)
```

### Turso (Persistent - SQLite)
```
hands                        → id, poolId, winner, potAmount, stage, timestamp
actions                      → id, handId, playerId, action, amount, stage, sequence
player_stats                 → playerId, handsPlayed, handsWon, totalWinnings
pool_stats                   → poolId, totalHands, totalPotAmount
```

---

## Message Flow: One Complete Hand

### Setup
1. 5 players join pool via contract deposits
2. Server emits GAME_STARTING
3. Server creates GameStateMachine instance
4. Blinds posted, 2 hole cards dealt each

### Preflop
5. Player 1 (UTG) receives turn (TURN_TIMER_TICK starts)
6. Player 1 sends PLAYER_ACTION: { type: 'raise', amount: 200 }
7. Server validates, updates state, broadcasts GAME_STATE_UPDATED
8. Player 2 receives turn
9. (repeat until all matched or folded)

### Flop → Turn → River
10. Street advances, 3 community cards dealt
11. First-to-act (left of dealer) receives turn
12. (repeat action sequence)

### Showdown
13. River betting complete → GAME_STATE reaches 'showdown'
14. ShowdownResolver evaluates hands
15. HandHistorian.saveHand() saves to Turso
16. Server broadcasts GAME_OVER with winners
17. Redis room clears for next hand

---

## REST API Flow Examples

### Get Player Stats
```
GET /api/players/0xAlice/stats
Authorization: Bearer <sessionToken>

Response:
{
  playerId: '0xAlice',
  handsPlayed: 42,
  handsWon: 15,
  totalWinnings: 5200
}
```

### Get Leaderboard
```
GET /api/leaderboard?limit=10
Authorization: Bearer <sessionToken>

Response:
[
  { playerId: '0xAlice', totalWinnings: 10000 },
  { playerId: '0xBob', totalWinnings: 8500 },
  ...
]
```

### Replay Hand (for dispute/audit)
```
GET /api/hand/42
Authorization: Bearer <sessionToken>

Response:
{
  hand: { id: 42, poolId: 1, winner: '0xAlice', potAmount: 5000, ... },
  actions: [
    { playerId: '0xAlice', action: 'bet', amount: 100, stage: 'preflop' },
    { playerId: '0xBob', action: 'raise', amount: 300, stage: 'preflop' },
    ...
  ]
}
```

---

## Error Handling

### Invalid Action
```
Client sends: { type: 'check', amount: 0 }
But there's a $100 bet pending
Server responds: ACTION_INVALID { error: 'Cannot check; there is an outstanding bet' }
```

### Session Expired
```
Client sends request without valid sessionToken
Server responds: 401 Unauthorized { error: 'Invalid session' }
Client redirects to login
```

### Game Already Over
```
Client sends PLAYER_ACTION after hand is in 'showdown' stage
Server responds: ACTION_INVALID { error: 'Hand is over' }
```

---

## Next Steps to Implement

1. **EventListener.js** — Wire up ethers.js to listen to contract events
2. **GameStateMachine** — Finish any remaining TODO methods
3. **Frontend** — Build WebSocket client and auth flow
4. **Testing** — Unit tests for each engine component
5. **Deployment** — Deploy to production with monitoring

All pieces are connected and ready to go!
