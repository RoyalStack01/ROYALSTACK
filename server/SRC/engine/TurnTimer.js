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


/**
 * TurnTimer.js
 * Manages player action countdowns and emits lifecycle events.
 */

import { EventEmitter } from 'events';

const TURN_DURATION_MS = 30000; // 30 seconds
const TICK_INTERVAL_MS = 1000;  // 1 second

export class TurnTimer extends EventEmitter {
  constructor() {
    super();
    this.playerId = null;
    this.endTime = null;
    this.timerId = null;
    this.intervalId = null;
  }

  /**
   * Starts a 30s countdown for a specific player.
   * @param {string} playerId 
   */
  start(playerId) {
    this.stop(); // Ensure any existing timer is cleared

    this.playerId = playerId;
    this.endTime = Date.now() + TURN_DURATION_MS;

    // Start the interval for 'TICK' events
    this.intervalId = setInterval(() => {
      const timeLeft = this.remaining;
      
      if (timeLeft > 0) {
        this.emit('TICK', { 
          playerId: this.playerId, 
          remaining: timeLeft 
        });
      }
    }, TICK_INTERVAL_MS);

    // Set the hard 'TIMEOUT'
    this.timerId = setTimeout(() => {
      this._handleTimeout();
    }, TURN_DURATION_MS);
  }

  /**
   * Restarts the timer for the current player.
   */
  reset() {
    if (!this.playerId) return;
    this.start(this.playerId);
  }

  /**
   * Clears all active timers and resets internal state.
   */
  stop() {
    if (this.timerId) clearTimeout(this.timerId);
    if (this.intervalId) clearInterval(this.intervalId);
    
    this.timerId = null;
    this.intervalId = null;
    this.playerId = null;
    this.endTime = null;
  }

  /**
   * Returns the remaining milliseconds until timeout.
   * @returns {number}
   */
  get remaining() {
    if (!this.endTime) return 0;
    const diff = this.endTime - Date.now();
    return Math.max(0, diff);
  }

  /**
   * Internal handler to clean up and emit the timeout event.
   * @private
   */
  _handleTimeout() {
    const expiredPlayerId = this.playerId;
    this.stop();
    this.emit('TIMEOUT', { playerId: expiredPlayerId });
  }
}