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

const VALID_ACTION_TYPES = new Set(['fold', 'check', 'call', 'bet', 'raise', 'all-in']);

/**
 * Filter hole cards so each player only sees their own.
 * Other players' hole cards are replaced with ['?', '?'].
 * @param {Object} state - Full game state
 * @param {string} viewerAddress - The wallet address of the receiving player
 * @returns {Object} Filtered state safe to send to viewerAddress
 */
function filterStateForPlayer(state, viewerAddress) {
  if (!state || !Array.isArray(state.players)) return state;

  const filteredPlayers = state.players.map((player) => {
    if (player.address?.toLowerCase() === viewerAddress.toLowerCase()) {
      return player;
    }
    return {
      ...player,
      holeCards: player.holeCards ? ['?', '?'] : null,
    };
  });

  return { ...state, players: filteredPlayers };
}

/**
 * Socket.io event handler for poker actions.
 * Processes folds, checks, calls, bets, and raises.
 */
export default function registerActionHandler(io, socket, redisClient) {
  // Per-socket timer map: poolId -> timeoutId
  const roomTimers = new Map();

  /**
   * Clear any pending turn timer for a given pool.
   */
  const clearRoomTimer = (poolId) => {
    if (roomTimers.has(poolId)) {
      clearTimeout(roomTimers.get(poolId));
      roomTimers.delete(poolId);
    }
  };

  /**
   * Main handler for 'player:action'
   * @param {Object} payload - poolId, playerId, action { type, amount }
   */
  const handleAction = async (payload) => {
    // Input validation
    if (!payload || typeof payload !== 'object') {
      socket.emit('action:error', { message: 'Invalid payload' });
      return;
    }

    const { poolId, playerId, action } = payload;

    if (typeof poolId !== 'string' || poolId.trim() === '') {
      socket.emit('action:error', { message: 'Invalid poolId' });
      return;
    }

    if (!action || typeof action !== 'object' || !VALID_ACTION_TYPES.has(action.type)) {
      socket.emit('action:error', {
        message: `Invalid action type. Must be one of: ${[...VALID_ACTION_TYPES].join(', ')}`,
      });
      return;
    }

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

      // 4. Broadcast new state to all players in the room, filtered per player
      const sockets = await io.in(poolId).fetchSockets();
      for (const s of sockets) {
        if (s.user?.walletAddress) {
          s.emit('room:update', filterStateForPlayer(updatedState, s.user.walletAddress));
        }
      }

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
    // Clear any existing timer for this pool on this socket's scope
    clearRoomTimer(poolId);

    // If game is still active, set a timeout for the next player
    if (state.status === 'IN_PROGRESS' && state.activePlayerId) {
      const timeoutMs = 30000; // 30 seconds

      const timerId = setTimeout(async () => {
        logger.info(`Player ${state.activePlayerId} timed out in room ${poolId}`);

        // Force an AUTO-FOLD action
        const autoFoldPayload = {
          poolId,
          playerId: state.activePlayerId,
          action: { type: 'fold' }
        };

        // Recursively call the handler
        handleAction(autoFoldPayload);
      }, timeoutMs);

      roomTimers.set(poolId, timerId);
    }
  };

  // Register the listener
  socket.on('player:action', handleAction);

  // Clear all timers associated with this socket on disconnect to prevent memory leaks
  socket.on('disconnect', () => {
    for (const [poolId, timerId] of roomTimers.entries()) {
      clearTimeout(timerId);
    }
    roomTimers.clear();
  });
}
