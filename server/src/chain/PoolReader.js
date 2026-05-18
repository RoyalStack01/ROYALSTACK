/**
 * Read-only view calls to the pool contract.
 *
 * Should implement view call methods:
 * - getPoolBalance(poolId): Returns current ETH balance in pool
 * - getPoolStatus(poolId): Returns pool state (OPEN, RUNNING, CLOSED, CANCELLED)
 * - getParticipants(poolId): Returns list of player addresses and their stakes
 * - getPoolConfig(poolId): Returns buyIn, seatCount, handDuration
 *
 * All methods are read-only (no state changes).
 * Use viem PublicClient for view calls.
 *
 * Usage:
 * const balance = await poolReader.getPoolBalance(poolId);
 */

import { createPublicClient, http } from 'viem';
import { mezoTestnet } from './mezo.config.js';
import poolAbi from './abis/Pool.json' assert { type: 'json' };
import env from '../config/env.js';

// TODO: Create PublicClient connected to RPC
// TODO: Implement getPoolBalance(poolId)
// TODO: Implement getPoolStatus(poolId)
// TODO: Implement getParticipants(poolId)
// TODO: Implement getPoolConfig(poolId)
// TODO: Add error handling for RPC failures
