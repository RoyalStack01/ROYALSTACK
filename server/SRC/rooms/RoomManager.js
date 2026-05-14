/**
 * Creates/closes Socket.io rooms and seats players post-DepositMade.
 *
 * Should:
 * - Create a Socket.io room for each pool (room: pool_{poolId})
 * - Wait for DepositMade event before allowing player to join/seat
 * - Track players in room and sync to Redis
 * - Close room when pool ends or is cancelled
 * - Broadcast room state updates to all connected clients
 *
 * Methods:
 * - createRoom(poolId, config): Set up new Socket.io room
 * - closeRoom(poolId): Tear down and cleanup
 * - seatPlayer(poolId, playerId, address): Add player to game state
 * - removePlayer(poolId, playerId): Remove player (disconnect/fold)
 * - broadcastUpdate(poolId, update): Send to all players in room
 */



import { redisClient } from '../config/redis.js';
import { logger } from '../config/logger.js';

// TODO: Implement createRoom(io, poolId, config)
// TODO: Implement closeRoom(poolId)
// TODO: Implement seatPlayer(poolId, playerId, address)
// TODO: Implement removePlayer(poolId, playerId)
// TODO: Implement broadcastUpdate(poolId, update)
// TODO: Implement room state persistence in Redis
