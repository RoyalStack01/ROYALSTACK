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
