/**
 * Express + Socket.io server bootstrap.
 *
 * Should:
 * - Initialize Express app
 * - Set up CORS middleware
 * - Set up error handler middleware
 * - Initialize Socket.io server with auth and rate limiter
 * - Register socket event handlers (join, action, reconnect)
 * - Register timer event handlers for auto-fold on timeout
 * - Create HTTP server and export for index.js to listen
 *
 * Usage:
 * import app from './app.js';
 * app.listen(3000);
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { corsMiddleware, socketCorsOptions } from './middleware/cors.js';
import { socketAuthMiddleware } from './middleware/auth.js';
import { rateLimitMiddleware } from './sockets/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './config/logger.js';

// TODO: Create Express app instance
// TODO: Add cors middleware
// TODO: Add request logging middleware
// TODO: Create HTTP server from app
// TODO: Create Socket.io server with cors and auth
// TODO: Register socket.io middleware (auth, rate limit)
// TODO: Register socket event handlers
// TODO: Add error handler as last middleware
// TODO: Export app and http server
