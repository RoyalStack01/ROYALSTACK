/**
 * ioredis client singleton with reconnect logic.
 *
 * Should:
 * - Initialize Redis connection using REDIS_URL from env
 * - Handle reconnection on connection loss
 * - Provide methods to store/retrieve game state, player sessions, room data
 * - Use TTL on keys for automatic cleanup
 *
 * Stores:
 * - room:{poolId}:state  → RoomState
 * - room:{poolId}:players → PlayerState map
 * - oracle:commit:{poolId}:{nonce} → { seed, commitment }
 * - player:session:{playerId} → session data for reconnect
 */

import Redis from 'ioredis';
import env from './env.js';
import { logger } from './logger.js';

export const redisClient = new Redis(env.REDIS_URL, {
    retryStrategy(times) {
        // Reconnect after an exponentially increasing delay, capped at 3 seconds
        const delay = Math.min(times * 100, 3000);
        return delay;
    },
});

redisClient.on('connect', () => {
    logger.info('Connected to Redis');
});

redisClient.on('error', (err) => {
    logger.error(`Redis connection error: ${err.message}`);
});

redisClient.on('reconnecting', () => {
    logger.warn('Reconnecting to Redis...');
});

export const redisHelpers = {
    async saveRoomState(poolId, state, ttlSeconds = 86400) {
        await redisClient.set(`room:${poolId}:state`, JSON.stringify(state), 'EX', ttlSeconds);
    },

    async getRoomState(poolId) {
        const data = await redisClient.get(`room:${poolId}:state`);
        return data ? JSON.parse(data) : null;
    },

    async savePlayerSession(playerId, sessionData, ttlSeconds = 86400) {
        await redisClient.set(`player:session:${playerId}`, JSON.stringify(sessionData), 'EX', ttlSeconds);
    },

    async getPlayerSession(playerId) {
        const data = await redisClient.get(`player:session:${playerId}`);
        return data ? JSON.parse(data) : null;
    }
};
