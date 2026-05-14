/**
 * Socket.io event handler: player:reconnect
 *
 * Should:
 * - Listen for player:reconnect events from clients
 * - Load player session from Redis (within 60s window)
 * - Verify player address and poolId match
 * - Restore all game state: hole cards, action history, pot, etc.
 * - Rejoin socket to the room
 * - Send full game state to client
 * - If session expired: return error and redirect to lobby
 *
 * Event payload:
 * {
 *   playerId: string,
 *   poolId: string,
 *   address: string (wallet address)
 * }
 *
 * Usage:
 * socket.on('player:reconnect', handleReconnect);
 */

import { ReconnectHandler } from '../rooms/ReconnectHandler.js';
import { logger } from '../config/logger.js';

// TODO: Implement event listener for 'player:reconnect'
// TODO: Implement session restoration from Redis
// TODO: Implement address verification
// TODO: Implement socket rejoin to room
// TODO: Implement timeout error (session expired)
// TODO: Implement full state sync to client

import { ReconnectHandler } from '../rooms/ReconnectHandler.js';
import { logger } from '../config/logger.js';

/**
 * Socket.io event handler for player reconnections.
 * Restores player session and game state if within the allowed window.
 */
export default function registerReconnectHandler(io, socket, redisClient) {
  
  /**
   * Main handler for 'player:reconnect'
   * @param {Object} payload - { playerId, poolId, address }
   */
  const handleReconnect = async (payload) => {
    const { playerId, poolId, address } = payload;

    try {
      logger.info(`Player ${playerId} attempting to reconnect to Pool ${poolId}`);

      // 1. Load session/state from Redis
      // We check if the room state exists and if the player is part of it
      const roomData = await redisClient.get(`room:state:${poolId}`);
      
      if (!roomData) {
        logger.warn(`Reconnect failed: Pool ${poolId} not found or expired.`);
        return socket.emit('reconnect:error', { 
          message: 'Session expired or game ended. Redirecting to lobby...',
          redirect: true 
        });
      }

      const state = JSON.parse(roomData);

      // 2. Verify player address and identity match the seat
      const playerInSeat = state.players.find(p => p.id === playerId);
      
      if (!playerInSeat || playerInSeat.address.toLowerCase() !== address.toLowerCase()) {
        logger.error(`Reconnect verification failed for ${playerId}`);
        return socket.emit('reconnect:error', { message: 'Invalid session credentials.' });
      }

      // 3. Rejoin socket to the room
      socket.join(poolId);

      // 4. Update the player's current socket ID in the state (optional but recommended)
      playerInSeat.socketId = socket.id;
      await redisClient.set(`room:state:${poolId}`, JSON.stringify(state));

      // 5. Send full game state to client (including hole cards and action history)
      socket.emit('room:sync', {
        ...state,
        isReconnect: true
      });

      // 6. Broadcast to others that the player is back online
      socket.to(poolId).emit('player:back_online', { playerId });

      logger.info(`Player ${playerId} successfully reconnected to ${poolId}`);

    } catch (err) {
      logger.error(`Error during reconnect for ${playerId}: ${err.message}`);
      socket.emit('reconnect:error', { message: 'Internal server error during reconnection.' });
    }
  };

  // Register the listener
  socket.on('player:reconnect', handleReconnect);
}