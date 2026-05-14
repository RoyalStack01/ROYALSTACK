# RoyalStack — Frontend Integration Guide

## Config

| Key | Value |
|---|---|
| Network | Mezo Testnet — Chain ID `31611` |
| RPC | `https://rpc.test.mezo.org` |
| Pool Contract | `0x16CaA43924343bd66793108e0c22b701665ea5aa` |
| Deposit Token (Mezo Token ERC-20) | `0x7B7c000000000000000000000000000000000001` |
| Gas Token | mBTC — native currency, used only for transaction fees |
| Server (dev) | `http://localhost:3002` |

---

## How It Works (High Level)

The server owns the admin wallet. When a user starts a room, the **server** calls `createPool()` on-chain — the user never touches that function. What the frontend handles directly on the contract is **only deposit and withdraw**.

```
User clicks "Start Room"
  → POST /api/rooms/create           (server creates pool on-chain, returns poolId)
  → Show "Fund the Pot" screen
  → User: token.approve() + contract.deposit(poolId, amount)
  → Server detects DepositMade event, registers player
  → POST /api/pools/:poolId/join     (registers player in server state)
  → Wait for 4 more players
  → Game starts automatically at 5 players
```

---

## 1. Auth

Every REST call and the WebSocket connection require a session token.

### Step 1 — Get a nonce
```
POST /api/auth/nonce
Body: { "walletAddress": "0x..." }

Response: { "nonce": "abc123", "message": "Sign this message...\nNonce: abc123" }
```

### Step 2 — Sign and verify
User signs the `message` with their wallet (e.g. via ethers `signMessage`), then:
```
POST /api/auth/verify
Body: { "walletAddress": "0x...", "signature": "0x...", "message": "..." }

Response: { "sessionToken": "...", "walletAddress": "0x...", "expiresIn": 86400 }
```

Use the token on all subsequent calls:
```
Authorization: Bearer <sessionToken>
```

### Logout
```
POST /api/auth/logout
Authorization: Bearer <sessionToken>
```

---

## 2. Starting a Room

The frontend calls the server — the server creates the pool on-chain using its own wallet.

```
POST /api/rooms/create
Authorization: Bearer <sessionToken>

Response: { "poolId": "42" }
```

After getting `poolId`, immediately show the **Fund the Pot** screen (step 3).

---

## 3. Funding the Pot (Deposit)

This is the only time the frontend talks to the contract directly. Two transactions required. Players deposit **Mezo Token** (ERC-20) — not mBTC. mBTC is only needed in the wallet to cover gas on both transactions.

### Step A — Approve the contract to spend the user's Mezo Token
```js
const MEZO_TOKEN_ADDRESS = '0x7B7c000000000000000000000000000000000001';
const token = new ethers.Contract(MEZO_TOKEN_ADDRESS, ERC20_ABI, signer);
await token.approve(POOL_CONTRACT_ADDRESS, amount);
```

Minimum ERC-20 ABI needed for approval:
```json
[
  {
    "type": "function",
    "name": "approve",
    "inputs": [
      { "name": "spender", "type": "address" },
      { "name": "amount",  "type": "uint256" }
    ],
    "outputs": [{ "name": "", "type": "bool" }],
    "stateMutability": "nonpayable"
  }
]
```

### Step B — Deposit into the pool
```js
const pool = new ethers.Contract(POOL_CONTRACT_ADDRESS, POOL_ABI, signer);
await pool.deposit(poolId, amount);
```

ABI for `deposit`:
```json
{
  "type": "function",
  "name": "deposit",
  "inputs": [
    { "name": "poolId", "type": "uint256" },
    { "name": "amount", "type": "uint256" }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
}
```

### Step C — Register with server
After the deposit tx confirms, tell the server:
```
POST /api/pools/:poolId/join
Authorization: Bearer <sessionToken>
Body: { "amount": <same amount as deposit, as number> }

Response: { "poolId": "42", "playerCount": 1, "isFull": false }
```

---

## 4. Joining an Existing Room

User picks a room from the lobby. Same flow as above (steps 3A → 3B → 3C) but with an existing `poolId`.

### Browse open pools
```
GET /api/pools
Authorization: Bearer <sessionToken>

Response: [
  {
    "poolId": "42",
    "status": "ACTIVE",
    "playerCount": 3,
    "isFull": false,
    "totalDeposited": "3000000000000000000",
    "creator": "0x...",
    "cancellationInfo": null
  }
]
```

### Get a single pool
```
GET /api/pools/:poolId
Authorization: Bearer <sessionToken>

Response: {
  "poolId": "42",
  "status": "ACTIVE",
  "playerCount": 3,
  "isFull": false,
  "players": [
    { "address": "0x...", "stack": 1000, "joinedAt": 1715600000000, "status": "active" }
  ],
  "totalDeposited": "3000000000000000000",
  "creator": "0x...",
  "cancellationInfo": null
}
```

---

## 5. Real-time Game (WebSocket)

Connect after auth:
```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:3002', {
  auth: { token: sessionToken }
});
```

### Join the room channel
```js
socket.emit('JOIN_POOL', { poolId: '42' });
// Server confirms:
socket.on('POOL_JOINED', ({ poolId, walletAddress }) => { ... });
// Others in room see:
socket.on('PLAYER_JOINED', ({ walletAddress }) => { ... });
```

### Send a game action
```js
socket.emit('PLAYER_ACTION', {
  poolId: '42',
  action: {
    type: 'bet',   // 'bet' | 'call' | 'raise' | 'fold' | 'check'
    amount: 100    // omit for fold/check/call
  }
});
```

### Game state updates
Every action triggers this for all players in the room:
```js
socket.on('GAME_STATE_UPDATED', (state) => {
  // state.stage          → 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'
  // state.pot            → total chips in pot
  // state.currentPlayer  → walletAddress whose turn it is
  // state.communityCards → ['Ah', 'Kd', '7c'] (grows each street)
  // state.players[]      → see below
  // state.winners        → null until showdown
});
```

Player object inside `state.players`:
```js
{
  walletAddress: '0x...',
  chips: 9500,
  bet: 100,
  folded: false,
  holeCards: ['As', 'Ks']  // only populated for the authenticated player
                             // null for all other players until showdown
}
```

### Other events to handle
| Event | When | Payload |
|---|---|---|
| `ACTION_INVALID` | Your action was rejected | `{ error: string }` |
| `PLAYER_LEFT` | Someone disconnected | `{ walletAddress }` |
| `HAND_SAVED` | Hand recorded after showdown | `{ handId }` |

### Leave a room
```js
socket.emit('LEAVE_POOL', { poolId: '42' });
```

---

## 6. Leaving a Room (Before Game Starts)

A player who has already deposited calls `withdrawDeposit()` directly on the contract to take their Mezo Token back out. The server detects the `WithdrawalMade` event and removes them from the room automatically.

### Step 1 — Call withdrawDeposit on-chain
```js
const pool = new ethers.Contract(POOL_CONTRACT_ADDRESS, POOL_ABI, signer);
await pool.withdrawDeposit(poolId);
```

ABI:
```json
{
  "type": "function",
  "name": "withdrawDeposit",
  "inputs": [{ "name": "poolId", "type": "uint256" }],
  "outputs": [],
  "stateMutability": "nonpayable"
}
```

### Step 2 — Notify server
After the tx confirms, tell the server to update its state:
```
POST /api/pools/:poolId/leave
Authorization: Bearer <sessionToken>

Response: { "message": "Left pool", "poolId": "42", "playersRemaining": 2 }
```

---

## 7. Pool Cancellation (Server-Triggered)

The server calls `cancelPool()` when the room doesn't reach 5 players within 10 minutes. This is automatic — players do not trigger it.

`cancelPool()` **automatically refunds all remaining depositors** in the same transaction. No action required from players — their Mezo Token is returned immediately when the tx confirms.

Listen for `WithdrawalMade` events per participant to confirm individual refunds landed.

```
GET /api/pools/:poolId/cancellation-info
Authorization: Bearer <sessionToken>

Response (cancelled): { "cancelled": true, "reason": "timeout", "timestamp": 1715600000000 }
Response (active):    { "cancelled": false }
```

---

## 8. Player Stats

```
GET /api/players/:walletAddress/stats
Authorization: Bearer <sessionToken>

Response: { "handsPlayed": 12, "handsWon": 4, "totalWinnings": 8000 }
```

```
GET /api/leaderboard?limit=10
Authorization: Bearer <sessionToken>
```

---

## 9. Contract Events to Watch (Optional)

If the frontend wants to react to on-chain events without polling the server:

| Event | Trigger |
|---|---|
| `DepositMade(poolId, participant, amount)` | Player funded the pot |
| `PoolCancelled(poolId, creator)` | Pool was cancelled — refunds are processing |
| `WithdrawalMade(poolId, participant, amount)` | One participant's refund confirmed (emitted per player by `cancelPool`) |
| `awardedPot(poolId, participant, amount)` | Winner paid out |

Full ABI is in `src/chain/abis/Pool.json`.

---

## 10. Error Responses

```json
{ "error": "Human readable message" }
```

| Status | Meaning |
|---|---|
| 400 | Validation failed / bad request |
| 401 | Missing or expired session token |
| 403 | Admin only |
| 404 | Pool not found |
| 429 | Rate limited — 20 auth req/min, 10 game actions/5s |
| 500 | Server error |
