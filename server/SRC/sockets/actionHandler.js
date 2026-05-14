/**
 * Socket.io event handler: player:action
 *
 * Should:
 * - Listen for player:action events from clients
 * - Validate action using ActionValidator (check/bet/call/raise/fold legality)
 * - Update game state using GameStateMachine
 * - Persist updated state to Redis
 * - Broadcast new state to all players in room
 * - Emit TIMEOUT action if turn timer expires (forced fold)
 *
 * Event payload:
 * {
 *   poolId: string,
 *   playerId: string,
 *   action: { type: 'fold'|'check'|'call'|'bet'|'raise', amount?: number }
 * }
 *
 * Usage:
 * socket.on('player:action', handleAction);
 */

import { GameStateMachine } from '../engine/GameStateMachine.js';
import { RoomState } from '../rooms/RoomState.js';
import { logger } from '../config/logger.js';

// TODO: Implement event listener for 'player:action'
// TODO: Implement action validation
// TODO: Implement state update and Redis persistence
// TODO: Implement broadcast to room
// TODO: Implement error handling and response to client
// TODO: Implement timeout-triggered auto-fold


import { GameStateMachine } from '../engine/GameStateMachine.js';
import { RoomState } from '../rooms/RoomState.js';
import { logger } from '../config/logger.js';

/**
 * Socket.io event handler for poker actions.
 * Processes folds, checks, calls, bets, and raises.
 */
export default function registerActionHandler(io, socket, redisClient) {
  
  /**
   * Main handler for 'player:action'
   * @param {Object} payload - poolId, playerId, action { type, amount }
   */
  const handleAction = async (payload) => {
    const { poolId, playerId, action } = payload;

    try {
      logger.info(`Action received from ${playerId} in room ${poolId}: ${action.type}`);

      // 1. Fetch current state from Redis
      const roomData = await redisClient.get(`room:state:${poolId}`);
      if (!roomData) throw new Error('Room state not found');
      
      let currentState = JSON.parse(roomData);

      // 2. Validate Action & Update State via GameStateMachine
      // The State Machine checks if it's the player's turn and if the action is legal
      const result = GameStateMachine.processAction(currentState, playerId, action);

      if (!result.success) {
        // Notify the specific player that their move was invalid
        socket.emit('action:error', { message: result.error });
        return;
      }

      const updatedState = result.newState;

      // 3. Persist updated state to Redis
      await redisClient.set(`room:state:${poolId}`, JSON.stringify(updatedState));

      // 4. Broadcast new state to all players in the room
      io.to(poolId).emit('room:update', updatedState);

      // 5. Handle Turn Transitions & Timeouts
      handleTurnTransition(io, poolId, updatedState, redisClient);

    } catch (err) {
      logger.error(`Failed to process player action: ${err.message}`);
      socket.emit('error', { message: 'Internal server error processing action' });
    }
  };

  /**
   * Internal logic to handle what happens after a successful action
   * (e.g., setting a timer for the next player)
   */
  const handleTurnTransition = (io, poolId, state, redis) => {
    // Clear any existing timers for this room
    clearTimeout(global.roomTimers?.[poolId]);

    // If game is still active, set a timeout for the next player
    if (state.status === 'IN_PROGRESS' && state.activePlayerId) {
      const timeoutMs = 30000; // 30 seconds for a hackathon is standard

      if (!global.roomTimers) global.roomTimers = {};
      
      global.roomTimers[poolId] = setTimeout(async () => {
        logger.info(`Player ${state.activePlayerId} timed out in room ${poolId}`);
        
        // Force an AUTO-FOLD action
        const autoFoldPayload = {
          poolId,
          playerId: state.activePlayerId,
          action: { type: 'fold' }
        };
        
        // Recursively call the handler or a specific auto-fold function
        handleAction(autoFoldPayload);
      }, timeoutMs);
    }
  };

  // Register the listener
  socket.on('player:action', handleAction);
}