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
