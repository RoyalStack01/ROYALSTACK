/**
 * Turso database client for poker game history.
 * Handles persistent storage of hands, actions, and player stats.
 *
 * Usage:
 * const db = new TursoClient(process.env.TURSO_CONNECTION_URL, process.env.TURSO_AUTH_TOKEN);
 * await db.recordHand(poolId, handNumber, winner, potAmount, stage);
 * await db.recordAction(handId, playerId, action, amount, stage, sequence);
 * await db.getPlayerStats(playerId);
 */

import { createClient } from "@libsql/client";

export default class TursoClient {
  constructor(connectionUrl, authToken) {
    if (!connectionUrl) {
      throw new Error("TURSO_CONNECTION_URL is required");
    }
    this.client = createClient({
      url: connectionUrl,
      authToken: authToken,
    });
  }

  /**
   * Record a completed hand to the database
   * @param {number} poolId - Pool identifier from contract
   * @param {number} handNumber - Hand sequence number in pool
   * @param {string} winner - Winning player address
   * @param {number} potAmount - Total chips in pot
   * @param {string} stage - Final stage (preflop, flop, turn, river, showdown)
   * @returns {Promise<number>} Insert id
   */
  async recordHand(poolId, handNumber, winner, potAmount, stage) {
    const result = await this.client.execute({
      sql: `INSERT INTO hands (poolId, handNumber, winner, potAmount, stage)
            VALUES (?, ?, ?, ?, ?)`,
      args: [poolId, handNumber ?? 1, winner, Number(potAmount) || 0, stage],
    });
    // libsql returns lastInsertRowid as BigInt — convert so callers can pass it as SQL args
    return Number(result.lastInsertRowid);
  }

  /**
   * Record an action (bet, fold, call, raise, check)
   * @param {number} handId - Hand id from recordHand
   * @param {string} playerId - Player address
   * @param {string} action - 'bet', 'fold', 'call', 'raise', 'check'
   * @param {number} amount - Chips wagered
   * @param {string} stage - Betting stage
   * @param {number} sequence - Order of actions in hand
   * @returns {Promise<number>} Insert id
   */
  async recordAction(handId, playerId, action, amount, stage, sequence) {
    const result = await this.client.execute({
      sql: `INSERT INTO actions (handId, playerId, action, amount, stage, sequence)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [Number(handId), playerId, action, Number(amount) || 0, stage, sequence],
    });
    return Number(result.lastInsertRowid);
  }

  /**
   * Get player statistics
   * @param {string} playerId - Player address
   * @returns {Promise<Object>} { playerId, handsPlayed, handsWon, totalWinnings, totalRakePaid }
   */
  async getPlayerStats(playerId) {
    const result = await this.client.execute({
      sql: `SELECT playerId, handsPlayed, handsWon, totalWinnings, totalRakePaid
            FROM player_stats WHERE playerId = ?`,
      args: [playerId],
    });
    return result.rows[0] || null;
  }

  /**
   * Get leaderboard: top players by winnings
   * @param {number} limit - Number of top players to return
   * @returns {Promise<Array>} Array of player stats ordered by totalWinnings DESC
   */
  async getLeaderboard(limit = 10) {
    const result = await this.client.execute({
      sql: `SELECT playerId, handsPlayed, handsWon, totalWinnings
            FROM player_stats
            ORDER BY totalWinnings DESC
            LIMIT ?`,
      args: [limit],
    });
    return result.rows;
  }

  /**
   * Get all hands in a pool
   * @param {number} poolId - Pool identifier
   * @returns {Promise<Array>} Array of hand records
   */
  async getPoolHands(poolId) {
    const result = await this.client.execute({
      sql: `SELECT id, poolId, handNumber, timestamp, winner, potAmount, stage
            FROM hands WHERE poolId = ?
            ORDER BY handNumber ASC`,
      args: [poolId],
    });
    return result.rows;
  }

  /**
   * Replay a hand: get all actions in sequence
   * @param {number} handId - Hand identifier
   * @returns {Promise<Array>} Array of actions in sequence order
   */
  async replayHand(handId) {
    const result = await this.client.execute({
      sql: `SELECT playerId, action, amount, stage, sequence
            FROM actions WHERE handId = ?
            ORDER BY sequence ASC`,
      args: [handId],
    });
    return result.rows;
  }

  /**
   * Update player stats after hand completes
   * Called after recordHand and all recordAction calls
   * @param {string} playerId - Player address
   * @param {boolean} won - Did player win the hand
   * @param {number} winnings - Net chips won/lost (can be negative)
   * @returns {Promise<void>}
   */
  async updatePlayerStats(playerId, won, winnings) {
    await this.client.execute({
      sql: `INSERT INTO player_stats (playerId, handsPlayed, handsWon, totalWinnings)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(playerId) DO UPDATE SET
              handsPlayed = handsPlayed + 1,
              handsWon = handsWon + ?,
              totalWinnings = totalWinnings + ?,
              lastUpdated = CURRENT_TIMESTAMP`,
      args: [playerId, 1, won ? 1 : 0, Math.round(winnings), won ? 1 : 0, Math.round(winnings)],
    });
  }

  /**
   * Update pool stats after hand completes
   * @param {number} poolId - Pool identifier
   * @param {number} potAmount - Pot size
   * @returns {Promise<void>}
   */
  async updatePoolStats(poolId, potAmount) {
    await this.client.execute({
      sql: `INSERT INTO pool_stats (poolId, totalHands, totalPotAmount)
            VALUES (?, 1, ?)
            ON CONFLICT(poolId) DO UPDATE SET
              totalHands = totalHands + 1,
              totalPotAmount = totalPotAmount + ?,
              lastUpdated = CURRENT_TIMESTAMP`,
      args: [poolId, potAmount, potAmount],
    });
  }

  /**
   * Get pool statistics
   * @param {number} poolId - Pool identifier
   * @returns {Promise<Object>} { poolId, totalHands, totalPotAmount, totalRakeCollected }
   */
  async getPoolStats(poolId) {
    const result = await this.client.execute({
      sql: `SELECT poolId, totalHands, totalPotAmount, totalRakeCollected
            FROM pool_stats WHERE poolId = ?`,
      args: [poolId],
    });
    return result.rows[0] || null;
  }

  /**
   * Get hand details with all actions
   * @param {number} handId - Hand identifier
   * @returns {Promise<Object>} { hand, actions }
   */
  async getHandDetails(handId) {
    const handResult = await this.client.execute({
      sql: `SELECT id, poolId, handNumber, timestamp, winner, potAmount, stage
            FROM hands WHERE id = ?`,
      args: [handId],
    });

    const actionsResult = await this.client.execute({
      sql: `SELECT playerId, action, amount, stage, sequence
            FROM actions WHERE handId = ?
            ORDER BY sequence ASC`,
      args: [handId],
    });

    return {
      hand: handResult.rows[0] || null,
      actions: actionsResult.rows,
    };
  }

  /**
   * Create all required tables if they don't exist.
   * Safe to call on every startup.
   */
  async createTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS hands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        poolId TEXT NOT NULL,
        handNumber INTEGER NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        winner TEXT,
        potAmount INTEGER DEFAULT 0,
        stage TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        handId INTEGER NOT NULL,
        playerId TEXT NOT NULL,
        action TEXT NOT NULL,
        amount INTEGER DEFAULT 0,
        stage TEXT,
        sequence INTEGER
      )`,
      `CREATE TABLE IF NOT EXISTS player_stats (
        playerId TEXT PRIMARY KEY,
        handsPlayed INTEGER DEFAULT 0,
        handsWon INTEGER DEFAULT 0,
        totalWinnings REAL DEFAULT 0,
        totalRakePaid REAL DEFAULT 0,
        lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS pool_stats (
        poolId TEXT PRIMARY KEY,
        totalHands INTEGER DEFAULT 0,
        totalPotAmount INTEGER DEFAULT 0,
        totalRakeCollected INTEGER DEFAULT 0,
        lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
    ];
    for (const sql of tables) {
      await this.client.execute(sql);
    }
  }

  /**
   * Health check: verify connection
   * @returns {Promise<boolean>}
   */
  async ping() {
    try {
      await this.client.execute("SELECT 1");
      return true;
    } catch (error) {
      console.error("Turso connection failed:", error);
      return false;
    }
  }
}
