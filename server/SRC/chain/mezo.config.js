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

export const mezoTestnet = defineChain({
    id: 31611,
    name: 'Mezo Testnet',
    network: 'mezo-testnet',
    nativeCurrency: {
        decimals: 18,
        name: 'Bitcoin',
        symbol: 'BTC',
    },
    rpcUrls: {
        default: { http: [env.RPC_URL || 'https://rpc.test.mezo.org'] },
        public: { http: [env.RPC_URL || 'https://rpc.test.mezo.org'] },
    },
    blockExplorers: {
        default: { name: 'Mezo Testnet Explorer', url: 'https://explorer.test.mezo.org' },
    },
});

export const mezoMainnet = defineChain({
    id: 31612,
    name: 'Mezo Mainnet',
    network: 'mezo-mainnet',
    nativeCurrency: {
        decimals: 18,
        name: 'Bitcoin',
        symbol: 'BTC',
    },
    rpcUrls: {
        default: { http: [env.RPC_URL || 'https://rpc.mezo.org'] },
        public: { http: [env.RPC_URL || 'https://rpc.mezo.org'] },
    },
    blockExplorers: {
        default: { name: 'Mezo Explorer', url: 'https://explorer.mezo.org' },
    },
});
