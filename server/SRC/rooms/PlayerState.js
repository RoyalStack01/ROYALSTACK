/**
 * Redis read/write for player state: room:{poolId}:players
 *
 * Should store per-player data:
 * - Stack size, total chips committed
 * - Hole cards (only for current hand, hidden from others until showdown)
 * - Action history (check/bet/raise/fold/call)
 * - Bet this street, all-in status
 * - Final hand ranking (after showdown)
 * - Seat index, address
 *
 * Methods:
 * - save(poolId, playerId, playerData): Store player state
 * - load(poolId, playerId): Retrieve player data
 * - loadAll(poolId): Get all players in room
 * - update(poolId, playerId, delta): Merge changes
 * - remove(poolId, playerId): Delete player record
 *
 * Usage:
 * await playerState.save(poolId, playerId, { stack: 1000, holeCards: ['As', 'Ks'] });
 */



import { redisClient } from '../config/redis.js';

// TODO: Implement save(poolId, playerId, playerData)
// TODO: Implement load(poolId, playerId)
// TODO: Implement loadAll(poolId)
// TODO: Implement update(poolId, playerId, delta)
// TODO: Implement remove(poolId, playerId)
// TODO: Add encryption for hole cards in Redis
