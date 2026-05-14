/**
 * Rate limiter middleware for Socket.io.
 *
 * Should:
 * - Limit each socket connection to 1 action per 500ms
 * - Track action timestamps per socket connection
 * - Reject excess actions with an error event
 * - Use in-memory map (per-connection state)
 *
 * Usage:
 * io.use(rateLimitMiddleware);
 */

// TODO: Implement middleware function
// TODO: Track last action timestamp per socket.id
// TODO: Implement 500ms rate limit check
// TODO: Emit 'error:rate_limit' to client on violation
// TODO: Clean up stale socket records on disconnect
import { logger } from '../config/logger.js';

/**
 * Rate limiter middleware for Socket.io.
 * 
 * Logic:
 * - Limit each socket connection to 1 action per 500ms
 * - Track action timestamps per socket connection
 * - Reject excess actions with an error event
 * - Use in-memory map (per-connection state)
 */

const RATE_LIMIT_MS = 500;
const lastActionMap = new Map();

/**
 * Middleware function for Socket.io
 * @param {Object} socket - The socket instance
 * @param {Function} next - The next middleware/handler
 */
export const rateLimitMiddleware = (socket, next) => {
  // Use socket.use to intercept incoming events
  socket.use(([event, ...args], nextEvent) => {
    
    // Only rate limit specific player interactions
    const throttledEvents = ['player:action', 'player:join'];

    if (throttledEvents.includes(event)) {
      const now = Date.now();
      const lastAction = lastActionMap.get(socket.id) || 0;

      if (now - lastAction < RATE_LIMIT_MS) {
        logger.warn(`Rate limit violation: ${socket.id} on ${event}`);
        
        // Emit error back to the client
        return socket.emit('error:rate_limit', {
          message: 'Too many actions. Please wait a moment.',
          retryAfter: RATE_LIMIT_MS - (now - lastAction)
        });
      }

      // Action allowed: update the timestamp
      lastActionMap.set(socket.id, now);
    }

    nextEvent();
  });

  // Clean up memory when player disconnects
  socket.on('disconnect', () => {
    lastActionMap.delete(socket.id);
  });

  next();
};

export default rateLimitMiddleware;