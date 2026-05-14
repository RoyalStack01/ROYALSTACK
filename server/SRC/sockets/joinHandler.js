/**
 * Socket.io event handler: player:join
 *
 * Should:
 * - Listen for player:join events from clients
 * - Verify player has made a deposit on-chain (DepositMade event)
 * - Verify seat is available in the pool
 * - Add player to room and seat in game
 * - Load current game state and send to client
 * - Broadcast updated player list to all clients
 * - Start hand if all seats filled and ready
 *
 * Event payload:
 * {
 *   poolId: string,
 *   playerId: string,
 *   address: string (wallet address)
 * }
 *
 * Usage:
 * socket.on('player:join', handleJoin);
 */

import { RoomManager } from '../rooms/RoomManager.js';
import { PoolReader } from '../chain/PoolReader.js';
import { logger } from '../config/logger.js';

// TODO: Implement event listener for 'player:join'
// TODO: Implement deposit verification (check DepositMade event)
// TODO: Implement seat availability check
// TODO: Implement room join and seat assignment
// TODO: Implement game state sync to client
// TODO: Implement broadcast to all clients
// TODO: Implement auto-start when pool full

import { RoomManager } from '../rooms/RoomManager.js';
import { PoolReader } from '../chain/PoolReader.js';
import { logger } from '../config/logger.js';

/**
 * Socket.io event handler for players joining a poker pool.
 * Bridges on-chain verification with real-time room management.
 */
export default function registerJoinHandler(io, socket, redisClient) {

  /**
   * Main handler for 'player:join'
   * @param {Object} payload - { poolId, playerId, address }
   */
  const handleJoin = async (payload) => {
    const { poolId, playerId, address } = payload;

    try {
      logger.info(`Player ${address} attempting to join Pool ${poolId}`);

      // 1. Verify player has made a deposit on-chain
      // PoolReader checks the Mezo contract for the 'DepositMade' event
      const hasDeposited = await PoolReader.verifyDeposit(poolId, address);
      if (!hasDeposited) {
        socket.emit('join:error', { message: 'No on-chain deposit detected for this pool.' });
        return;
      }

      // 2. Verify seat availability and join room
      // RoomManager handles the logic of seat assignments and Redis sync
      const room = await RoomManager.getRoom(poolId);
      if (room.isFull()) {
        socket.emit('join:error', { message: 'Pool is currently full.' });
        return;
      }

      // 3. Add player to Socket.io room and RoomState
      socket.join(poolId);
      const updatedState = await RoomManager.addPlayer(poolId, {
        id: playerId,
        address: address,
        socketId: socket.id
      });

      // 4. Load current game state and send to the joining client (Sync)
      socket.emit('room:sync', updatedState);

      // 5. Broadcast updated player list to all clients in the room
      io.to(poolId).emit('room:player_joined', {
        playerId,
        address,
        playerList: updatedState.players
      });

      logger.info(`Player ${playerId} successfully joined Pool ${poolId}`);

      // 6. Start hand if all seats are filled and players are ready
      if (updatedState.players.length === updatedState.maxPlayers && updatedState.status === 'WAITING') {
        logger.info(`Pool ${poolId} is full. Triggering game start...`);
        
        // Transition game state to IN_PROGRESS
        const startedState = await RoomManager.startGame(poolId);
        
        // Broadcast the start and the initial game state (blinds, button, etc.)
        io.to(poolId).emit('game:started', startedState);
      }

    } catch (err) {
      logger.error(`Join error in Pool ${poolId}: ${err.message}`);
      socket.emit('join:error', { message: 'Internal server error during join.' });
    }
  };

  // Register the listener
  socket.on('player:join', handleJoin);
}