/**
 * Listens to chain events and triggers game state updates.
 *
 * Should:
 * - Listen for DepositMade events from the pool contract
 * - When DepositMade fires: confirm player seat in Redis, emit room update
 * - Poll for new blocks and events on startup
 * - Handle reconnection if RPC connection drops
 * - Start automatically when server boots
 *
 * Emits to rooms:
 * - player:seated — player is confirmed in the game
 * - pool:cancelled — game cancelled, return funds
 *
 * Usage:
 * const listener = new EventListener(redisClient, logger);
 * listener.start();
 */

import { createPublicClient, http } from 'viem';
import { mezoTestnet } from './mezo.config.js';
import poolAbi from './abis/Pool.json' assert { type: 'json' };

// TODO: Implement constructor(redisClient, logger, io)
// TODO: Implement start() to begin polling for DepositMade events
// TODO: Implement _handleDepositMade(player, amount, poolId)
// TODO: Implement error handling and reconnection logic
// TODO: Implement graceful shutdown (stop listening)
