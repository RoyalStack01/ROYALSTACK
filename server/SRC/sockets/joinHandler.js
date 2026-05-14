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
