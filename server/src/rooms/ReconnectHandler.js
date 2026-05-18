/**
 * Restores player session from Redis within 60s of disconnect.
 * Path: SRC\rooms\ReconnectHandler.js
 */

import { redisClient } from '../config/redis.js';
import { logger } from '../config/logger.js';
import playerState from './PlayerState.js';

const SESSION_TIMEOUT = 30; // 30 seconds

const reconnectHandler = {
  /**
   * Store player session metadata to allow quick lookups on reconnect.
   * Links the playerId to a specific pool and verifies ownership via address.
   */
  async saveSession(playerId, poolId, address) {
    const sessionKey = `player:session:${playerId}`;
    try {
      const sessionData = {
        poolId,
        address,
        lastSeen: Date.now()
      };
      
      // Store session and set auto-expiry for 60 seconds
      await redisClient.set(sessionKey, JSON.stringify(sessionData), {
        EX: SESSION_TIMEOUT
      });
      
      logger.info(`Session saved for player ${playerId} in pool ${poolId}`);
    } catch (error) {
      logger.error(`Failed to save session for ${playerId}:`, error);
      throw new Error('SESSION_SAVE_FAILED');
    }
  },

  /**
   * Load all state from Redis and verify integrity.
   * Restores game-specific data (cards, stack, seat) using PlayerState.js
   */
  async restoreSession(playerId, providedAddress) {
    const sessionKey = `player:session:${playerId}`;
    
    try {
      // 1. Check if session exists in Redis
      const sessionRaw = await redisClient.get(sessionKey);
      if (!sessionRaw) {
        logger.warn(`Reconnect failed: Session for ${playerId} is stale or expired.`);
        return null; 
      }

      const session = JSON.parse(sessionRaw);

      // 2. Verify player's address matches stored session address
      if (session.address !== providedAddress) {
        logger.error(`Address mismatch for player ${playerId}. Reconnect denied.`);
        throw new Error('ADDRESS_VERIFICATION_FAILED');
      }

      // 3. Load full game state (cards, history, etc.) from the room's hash
      const fullPlayerState = await playerState.load(session.poolId, playerId);
      
      if (!fullPlayerState) {
        logger.error(`Session found but PlayerState for ${playerId} in ${session.poolId} is missing.`);
        return null;
      }

      logger.info(`Player ${playerId} successfully restored to room ${session.poolId}`);
      
      return {
        poolId: session.poolId,
        ...fullPlayerState
      };
    } catch (error) {
      logger.error(`Restore session error for ${playerId}:`, error);
      throw error;
    }
  },

  /**
   * Manually clean up a session (e.g., when a player explicitly quits or 60s passes)
   */
  async expireSession(playerId) {
    const sessionKey = `player:session:${playerId}`;
    try {
      await redisClient.del(sessionKey);
      logger.info(`Session for ${playerId} has been cleaned up.`);
    } catch (error) {
      logger.error(`Failed to delete session for ${playerId}:`, error);
    }
  }
};

export default reconnectHandler;