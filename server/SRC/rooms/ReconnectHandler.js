/**
 * Restores player session from Redis within 60s of disconnect.
 *
 * Should:
 * - Store session key when player joins: player:session:{playerId}
 * - On disconnect: mark socket as stale but keep Redis data for 60s
 * - On reconnect (within 60s): restore all game state from Redis
 * - Verify player's address matches stored address
 * - Rejoin player to the same room and seat
 * - Restore hole cards and action state
 * - If reconnect fails after 60s: clean up and return to lobby
 *
 * Methods:
 * - saveSession(playerId, poolId, gameState): Store player session
 * - restoreSession(playerId, poolId): Load all state from Redis
 * - expireSession(playerId): Delete stale session after timeout
 *
 * Usage:
 * await reconnect.restoreSession(playerId, poolId);
 */

import { redisClient } from '../config/redis.js';
import { logger } from '../config/logger.js';

// TODO: Implement saveSession(playerId, poolId, gameState)
// TODO: Implement restoreSession(playerId, poolId)
// TODO: Implement expireSession(playerId) with 60s timeout
// TODO: Add address verification on restore
// TODO: Add error handling for stale/invalid sessions
