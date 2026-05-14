/**
 * Entry point — starts server and boots EventListener.
 *
 * Should:
 * - Validate all env vars using env.js
 * - Initialize Redis connection
 * - Create HTTP server from app.js
 * - Start EventListener to watch for DepositMade events
 * - Listen on PORT from env
 * - Log server startup and any initialization errors
 *
 * Usage:
 * node src/index.js
 */

import env from './config/env.js';
import { redisClient } from './config/redis.js';
import { logger } from './config/logger.js';
import { app, httpServer } from './app.js';
import { EventListener } from './chain/EventListener.js';

// TODO: Start HTTP server listening on env.PORT
// TODO: Initialize Redis connection
// TODO: Start EventListener (listens for DepositMade events)
// TODO: Log startup message
// TODO: Handle process signals (SIGINT, SIGTERM) for graceful shutdown
// TODO: Close Redis and shutdown on exit

