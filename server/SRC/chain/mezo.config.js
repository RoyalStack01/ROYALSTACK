/**
 * Mezo EVM chain configuration for viem.
 *
 * Should:
 * - Define Mezo testnet (31611) and mainnet (31612) chain objects
 * - Set RPC URLs, block explorers, currency info
 * - Export as viem-compatible chain definitions
 * - Use RPC_URL from env
 *
 * Usage:
 * import { mezoTestnet } from './mezo.config.js';
 * const client = createPublicClient({ chain: mezoTestnet, transport: http(...) });
 */

import { defineChain } from 'viem';
import env from '../config/env.js';

// TODO: Define mezoTestnet chain (chainId: 31611)
// TODO: Define mezoMainnet chain (chainId: 31612)
// TODO: Set correct RPC URLs from env and chain data
// TODO: Add block explorer configuration
// TODO: Export both chain definitions
