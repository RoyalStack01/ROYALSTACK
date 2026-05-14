/**
 * Redis read/write for room state: room:{poolId}:state
 *
 * Should store and retrieve:
 * - Game stage (preflop, flop, turn, river, showdown)
 * - Community cards
 * - Pot, side pots, current bet
 * - Active player index, dealer button
 * - List of players (see PlayerState for individual data)
 * - Hand number/sequence
 *
 * Methods:
 * - save(poolId, gameState): Persist full game state to Redis
 * - load(poolId): Retrieve game state from Redis
 * - update(poolId, delta): Merge delta into existing state
 * - clear(poolId): Delete room state (hand/game over)
 *
 * Usage:
 * await roomState.save(poolId, { stage: 'flop', communityCards: [...] });
 */

import { redisClient } from '../config/redis.js';

// TODO: Implement save(poolId, gameState)
// TODO: Implement load(poolId)
// TODO: Implement update(poolId, delta)
// TODO: Implement clear(poolId)
// TODO: Add TTL to Redis keys (e.g., 24 hours)
// TODO: Implement error handling for Redis ops
