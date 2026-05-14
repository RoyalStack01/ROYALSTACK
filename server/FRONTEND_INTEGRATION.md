# RoyalStack — Frontend Integration Guide

**Network:** Mezo Testnet (Chain ID: 31611)  
**RPC:** `https://rpc.test.mezo.org`  
**Contract:** `0x16CaA43924343bd66793108e0c22b701665ea5aa`  
**Server:** `http://localhost:3002` (dev) — update to prod URL when deployed  
**Token:** `0x7B7c000000000000000000000000000000000001` (mBTC / MEZO)

---

## 1. Auth Flow

Every request (REST + WebSocket) requires a session token obtained by signing a nonce with the user's wallet.

```
1. GET  /api/auth/nonce   → { nonce, message }
2. User signs `message` with their wallet
3. POST /api/auth/verify  → { sessionToken, walletAddress, expiresIn }
4. Include token on all requests: Authorization: Bearer <sessionToken>
```

### POST /api/auth/nonce
```json
// Request
{ "walletAddress": "0x..." }

// Response
{ "nonce": "abc123", "message": "Sign this message to authenticate with RoyalStack...\nNonce: abc123" }
```

### POST /api/auth/verify
```json
// Request
{ "walletAddress": "0x...", "signature": "0x...", "message": "..." }

// Response
{ "sessionToken": "...", "walletAddress": "0x...", "expiresIn": 86400 }
```

### POST /api/auth/logout
```
Authorization: Bearer <token>
```

---

## 2. Contract Interaction

The frontend talks to the contract **directly** (not through the server) for deposits and withdrawals. The server listens to chain events and updates game state.

### Required ABIs

#### `deposit(uint256 poolId, uint256 amount)`
Player deposits into a pool. Requires prior ERC-20 approval for the contract address.

```json
{
  "type": "function",
  "name": "deposit",
  "inputs": [
    { "name": "poolId", "type": "uint256", "internalType": "uint256" },
    { "name": "amount", "type": "uint256", "internalType": "uint256" }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
}
```

**Flow:**
```
1. token.approve(CONTRACT_ADDRESS, amount)
2. pool.deposit(poolId, amount)
```

#### `withdrawDeposit(uint256 poolId)`
Player withdraws their deposit from a cancelled or not-yet-started pool.

```json
{
  "type": "function",
  "name": "withdrawDeposit",
  "inputs": [
    { "name": "poolId", "type": "uint256", "internalType": "uint256" }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
}
```

#### `createPool()` → `uint256 poolId`
Creates a new pool. Returns the new pool ID.

```json
{
  "type": "function",
  "name": "createPool",
  "inputs": [],
  "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
  "stateMutability": "nonpayable"
}
```

#### `getBalance(uint256 poolId)` → `uint256`
Total mBTC deposited in a pool.

#### `getUserBalance(uint256 poolId, address user)` → `uint256`
A specific player's deposit in a pool.

### Contract Events to Listen For
| Event | When |
|---|---|
| `PoolCreated(poolId, creator)` | New pool opened |
| `DepositMade(poolId, participant, amount)` | Player deposited |
| `WithdrawalMade(poolId, participant, amount)` | Player withdrew deposit |
| `PoolCancelled(poolId, creator)` | Pool was cancelled |
| `awardedPot(poolId, participant, amount)` | Winner paid out |

Full ABI is at `src/chain/abis/Pool.json`.

---

## 3. REST API

All endpoints below require `Authorization: Bearer <sessionToken>`.

### Pools

| Method | Path | Description |
|---|---|---|
| GET | `/api/pools` | List all pools with player count + cancellation info |
| GET | `/api/pools/:poolId` | Pool detail, player list, readiness |
| POST | `/api/pools/:poolId/join` | Register join in server state (call after `deposit()` on chain) |
| POST | `/api/pools/:poolId/leave` | Leave pool (creator leaving auto-cancels) |
| POST | `/api/pools/:poolId/cancel` | Creator cancels pool |
| GET | `/api/pools/:poolId/cancellation-info` | Cancellation status |

#### GET /api/pools/:poolId — Response
```json
{
  "poolId": "1",
  "creator": "0x...",
  "status": "ACTIVE",
  "createdAt": 1715600000000,
  "totalDeposited": "1000000000000000000",
  "players": ["0x...", "0x..."],
  "playerCount": 2,
  "isFull": false,
  "cancellationInfo": null
}
```

#### POST /api/pools/:poolId/join — Request
```json
{ "amount": 1000000000000000000 }
```

### Game Stats

| Method | Path | Description |
|---|---|---|
| GET | `/api/players/:walletAddress/stats` | Hands played, won, total winnings |
| GET | `/api/leaderboard?limit=10` | Top players |
| GET | `/api/hand/:handId` | Full hand history |
| GET | `/api/health` | Server health check (no auth) |

---

## 4. WebSocket (Socket.io)

Connect with the session token in auth:

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:3002', {
  auth: { token: sessionToken }
});
```

### Events — Client → Server

#### `JOIN_POOL`
```json
{ "poolId": "1" }
```

#### `PLAYER_ACTION`
```json
{
  "poolId": "1",
  "action": {
    "type": "bet | fold | call | raise | check",
    "amount": 100
  }
}
```

#### `LEAVE_POOL`
```json
{ "poolId": "1" }
```

### Events — Server → Client

| Event | Payload | When |
|---|---|---|
| `POOL_JOINED` | `{ poolId, walletAddress }` | Confirms your join |
| `PLAYER_JOINED` | `{ walletAddress }` | Another player joined the room |
| `PLAYER_LEFT` | `{ walletAddress }` | Player left the room |
| `GAME_STATE_UPDATED` | Full game state (see below) | After every action |
| `ACTION_INVALID` | `{ error: string }` | Your action was rejected |
| `HAND_SAVED` | `{ handId }` | Hand recorded to DB after showdown |

#### GAME_STATE_UPDATED Payload
```json
{
  "stage": "preflop | flop | turn | river | showdown",
  "handNumber": 1,
  "pot": 500,
  "currentPlayer": "0x...",
  "communityCards": ["Ah", "Kd", "7c"],
  "players": [
    {
      "walletAddress": "0x...",
      "chips": 9500,
      "bet": 100,
      "folded": false,
      "holeCards": ["As", "Ks"]
    }
  ],
  "winners": null,
  "sidePots": []
}
```

> Note: `holeCards` is only present for the authenticated player's own entry. Other players show `null` until showdown.

---

## 5. Typical Game Flow

```
1. Player calls createPool() on contract → gets poolId
2. Player calls token.approve() then deposit(poolId, amount)
3. Server detects DepositMade event, registers pool in Redis
4. Player calls POST /api/pools/:poolId/join (server-side registration)
5. Player connects via WebSocket and emits JOIN_POOL
6. Repeat steps 2–5 for up to 5 players
7. On 5th deposit, server starts the game automatically
8. Players send PLAYER_ACTION via WebSocket
9. Server emits GAME_STATE_UPDATED after each action
10. At showdown, server calls awardPot() on contract → winner gets funds
11. Players who lost can call withdrawDeposit() for any remaining balance
```

---

## 6. Error Responses

All REST errors follow:
```json
{ "error": "Human readable message" }
```

| Status | Meaning |
|---|---|
| 400 | Bad request / validation failed |
| 401 | Missing or expired session token |
| 403 | Admin-only endpoint |
| 404 | Pool / hand not found |
| 429 | Rate limited (20 auth requests/min, 10 actions/5s on WS) |
| 500 | Server error |
