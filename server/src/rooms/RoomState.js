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
 * - update(poolId, delta): Merge delta intogi existing state
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


/**
 * Redis read/write for room state: room:{poolId}:state
 * Path: SRC\rooms\RoomState.js
 */



import { redisClient } from '../config/redis.js';
import { logger } from '../config/logger.js';

const ROOM_STATE_TTL = 86400; // 24 hours in seconds

const RoomState = {
  /**
   * Persist full game state to Redis.
   * Sets a 24-hour expiration to ensure memory cleanup.
   */
  async save(poolId, gameState) {
    const key = `room:${poolId}:state`;
    try {
      const data = {
        ...gameState,
        lastUpdated: Date.now()
      };
      
      await redisClient.set(key, JSON.stringify(data), {
        EX: ROOM_STATE_TTL
      });
    } catch (error) {
      logger.error(`[RoomState Save Error] Pool ${poolId}:`, error);
      throw new Error(`FAILED_TO_SAVE_ROOM_STATE`);
    }
  },

  /**
   * Retrieve game state from Redis.
   */
  async load(poolId) {
    const key = `room:${poolId}:state`;
    try {
      const rawData = await redisClient.get(key);
      if (!rawData) return null;
      
      return JSON.parse(rawData);
    } catch (error) {
      logger.error(`[RoomState Load Error] Pool ${poolId}:`, error);
      throw new Error(`FAILED_TO_LOAD_ROOM_STATE`);
    }
  },

  /**
   * Merge delta into existing state.
   * Useful for updating just the pot or the current stage.
   */
  async update(poolId, delta) {
    try {
      const currentState = await this.load(poolId) || {};
      const updatedState = {
        ...currentState,
        ...delta,
        lastUpdated: Date.now()
      };

      await this.save(poolId, updatedState);
      return updatedState;
    } catch (error) {
      logger.error(`[RoomState Update Error] Pool ${poolId}:`, error);
      throw error;
    }
  },

  /**
   * Delete room state when the hand or game is officially over.
   */
  async clear(poolId) {
    const key = `room:${poolId}:state`;
    try {
      await redisClient.del(key);
      logger.info(`Room state cleared for pool ${poolId}`);
    } catch (error) {
      logger.error(`[RoomState Clear Error] Pool ${poolId}:`, error);
    }
  }
};

export default RoomState;