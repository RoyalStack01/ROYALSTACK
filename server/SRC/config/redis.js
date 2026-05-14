/**
 * ioredis client singleton with reconnect logic.
 *
 * Should:
 * - Initialize Redis connection using REDIS_URL from env
 * - Handle reconnection on connection loss
 * - Provide methods to store/retrieve game state, player sessions, room data
 * - Use TTL on keys for automatic cleanup
 *
 * Stores:
 * - room:{poolId}:state  → RoomState
 * - room:{poolId}:players → PlayerState map
 * - oracle:commit:{poolId}:{nonce} → { seed, commitment }
 * - player:session:{playerId} → session data for reconnect
 */

import Redis from 'ioredis';
import env from './env.js';

// TODO: Create Redis client from REDIS_URL
// TODO: Export client singleton
// TODO: Implement connection error handling and reconnection
// TODO: Add helper methods for game state operations
