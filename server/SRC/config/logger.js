/**
 * Pino structured logger for the server.
 *
 * Should:
 * - Initialize pino with appropriate transport (console for dev, file for prod)
 * - Log game events: hand start, player action, showdown result, errors
 * - Log chain events: deposit, pool created, reward released
 * - Log socket events: connect, disconnect, timeout
 * - Use different log levels: debug, info, warn, error
 * - Include context: poolId, playerId, actionType, etc.
 *
 * Usage:
 * logger.info({ poolId, playerId, action }, 'Player action');
 */

import pino from 'pino';
import env from './env.js';

// TODO: Create pino logger with appropriate transport
// TODO: Set log level based on NODE_ENV
// TODO: Export logger singleton
