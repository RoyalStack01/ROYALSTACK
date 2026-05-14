/**
 * 30-second action timer. Emits TICK every second and TIMEOUT when time expires.
 * Extends EventEmitter for event-driven timeout handling.
 *
 * Should:
 * - Start 30s countdown when start(playerId) is called
 * - Emit 'TICK' event every 1s with { playerId, remaining }
 * - Emit 'TIMEOUT' event after 30s with { playerId }
 * - Reset timer if reset() is called (stop and restart current player)
 * - Stop all timers and cleanup on stop()
 * - Track remaining milliseconds for UI display
 *
 * Methods:
 * - start(playerId): Begin timer for player
 * - reset(): Restart timer for current player
 * - stop(): Clear all timers
 * - get remaining(): Return milliseconds left
 *
 * Events:
 * - 'TICK': { playerId, remaining }
 * - 'TIMEOUT': { playerId }
 */

// TODO: Extend EventEmitter and import/export as ES module
// TODO: Define TURN_DURATION_MS (30000) and TICK_INTERVAL_MS (1000) constants
// TODO: Implement start(playerId)
// TODO: Implement tick interval logic
// TODO: Implement timeout logic
// TODO: Implement reset()
// TODO: Implement stop() with cleanup
// TODO: Implement remaining getter
