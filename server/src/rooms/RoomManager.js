/**
 * Creates/closes Socket.io rooms and seats players post-DepositMade.
 * Path: SRC\rooms\RoomManager.js
 */

import { redisClient } from '../config/redis.js';
import { logger } from '../config/logger.js';
import playerState from './PlayerState.js';

const RoomManager = {
  /**
   * Initialize a new room in Redis and prepare for socket connections.
   * @param {object} io - The Socket.io server instance
   */
  async createRoom(io, poolId, config) {
    const roomKey = `room:${poolId}:config`;
    try {
      const roomData = {
        poolId,
        config, // blinds, maxPlayers, buyIn, etc.
        status: 'WAITING_FOR_DEPOSITS',
        createdAt: Date.now()
      };

      // Persist room config to Redis
      await redisClient.set(roomKey, JSON.stringify(roomData));
      
      logger.info(`Room created: pool_${poolId}`);
      return roomData;
    } catch (error) {
      logger.error(`Error creating room ${poolId}:`, error);
      throw error;
    }
  },

  /**
   * Finalize player seating after DepositMade event.
   * Syncs to Redis via playerState.js
   */
  async seatPlayer(poolId, playerId, address, initialStack) {
    try {
      // 1. Verify room exists
      const roomExists = await redisClient.exists(`room:${poolId}:config`);
      if (!roomExists) throw new Error('ROOM_NOT_FOUND');

      // 2. Prepare initial player state
      const playerData = {
        address,
        stack: initialStack,
        totalCommitted: 0,
        holeCards: [],
        history: [],
        betThisStreet: 0,
        isAllIn: false,
        status: 'SEATED'
      };

      // 3. Persist to Redis using our PlayerState utility
      await playerState.save(poolId, playerId, playerData);
      
      logger.info(`Player ${playerId} seated in pool ${poolId}`);
      
      // 4. Return updated player list for broadcasting
      return await playerState.loadAll(poolId);
    } catch (error) {
      logger.error(`Error seating player ${playerId} in ${poolId}:`, error);
      throw error;
    }
  },

  /**
   * Broadcast an event to all clients in the specific pool room.
   */
  broadcastUpdate(io, poolId, updateType, payload) {
    const roomName = `room:pool_${poolId}`;
    io.to(roomName).emit('room_update', {
      type: updateType,
      data: payload,
      timestamp: Date.now()
    });
  },

  /**
   * Remove a player from the game state (e.g., leaving or disqualification).
   */
  async removePlayer(poolId, playerId) {
    try {
      await playerState.remove(poolId, playerId);
      logger.info(`Player ${playerId} removed from pool ${poolId}`);
    } catch (error) {
      logger.error(`Error removing player ${playerId}:`, error);
    }
  },

  /**
   * Tear down the room and clean up all associated Redis data.
   */
  async closeRoom(poolId) {
    try {
      const configKey = `room:${poolId}:config`;
      const playersKey = `room:${poolId}:players`;

      // Remove config and all players in the hash
      await Promise.all([
        redisClient.del(configKey),
        redisClient.del(playersKey)
      ]);

      logger.info(`Room pool_${poolId} closed and cleaned up.`);
    } catch (error) {
      logger.error(`Error closing room ${poolId}:`, error);
    }
  }
};

export default RoomManager;