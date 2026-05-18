/**
 * Admin tx builders for pool contract interaction.
 *
 * Should implement:
 * - createPool(buyIn, seatCount, handDuration): Creates a new pool, returns tx hash
 * - cancelPool(poolId): Closes pool early, returns tx hash
 * - releaseReward(poolId, winners, amounts): Releases reward to winners, returns tx hash
 *
 * Uses AdminSigner to sign transactions.
 * All methods are write operations (state-changing).
 *
 * Usage:
 * const txHash = await poolClient.createPool('0.1', 6, 600);
 */

import { getAdminSigner } from './AdminSigner.js';
import { mezoTestnet } from './mezo.config.js';
import { parseAbi } from 'viem';
import poolAbi from './abis/Pool.json' assert { type: 'json' };

// TODO: Implement createPool(buyIn, seatCount, handDuration)
// TODO: Implement cancelPool(poolId)
// TODO: Implement releaseReward(poolId, winners, amounts)
// TODO: Add error handling and transaction validation
