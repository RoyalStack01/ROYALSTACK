/**
 * Hand historian: bridges GameStateMachine to TursoClient.
 * Called when a hand completes to persist full game history.
 *
 * Usage:
 * const historian = new HandHistorian(tursoClient);
 * await historian.saveHand(poolId, handNumber, gameState, sidePots, winners);
 */

export default class HandHistorian {
  constructor(tursoClient) {
    if (!tursoClient) {
      throw new Error("TursoClient instance is required");
    }
    this.db = tursoClient;
  }

  /**
   * Save complete hand history after showdown
   * @param {number} poolId - Pool identifier from contract
   * @param {number} handNumber - Hand sequence
   * @param {Object} gameState - Full game state object with all actions taken
   * @param {Array} sidePots - Array of { amount, eligible, winners }
   * @param {Object} winners - Map of playerId → winnings for this hand
   * @returns {Promise<number>} Hand id in database
   */
  async saveHand(poolId, handNumber, gameState, sidePots, winners) {
    if (!gameState || !gameState.stage) {
      throw new Error("Invalid game state: missing stage");
    }

    // Determine overall winner (player with largest winnings)
    let winnerAddress = null;
    let maxWinnings = 0;
    for (const [playerId, winnings] of Object.entries(winners)) {
      if (winnings > maxWinnings) {
        maxWinnings = winnings;
        winnerAddress = playerId;
      }
    }

    // Calculate total pot
    const totalPot = sidePots.reduce((sum, pot) => sum + pot.amount, 0);

    // 1. Record hand summary
    const handId = await this.db.recordHand(
      poolId,
      handNumber,
      winnerAddress,
      totalPot,
      gameState.stage
    );

    // 2. Record all player actions in order
    if (gameState.actionHistory && Array.isArray(gameState.actionHistory)) {
      for (let i = 0; i < gameState.actionHistory.length; i++) {
        const action = gameState.actionHistory[i];
        await this.db.recordAction(
          handId,
          action.playerId,
          action.type, // 'bet', 'fold', 'call', 'raise', 'check'
          action.amount || 0,
          action.stage,
          i // sequence number
        );
      }
    }

    // 3. Update player stats for all players
    for (const [playerId, netWinnings] of Object.entries(winners)) {
      const didWin = playerId === winnerAddress;
      await this.db.updatePlayerStats(playerId, didWin, netWinnings);
    }

    // 4. Update pool stats
    await this.db.updatePoolStats(poolId, totalPot);

    return handId;
  }

  /**
   * Query player performance in a specific pool
   * @param {string} playerId - Player address
   * @param {number} poolId - Pool identifier
   * @returns {Promise<Object>} { handsPlayed, handsWon, totalWinnings, winRate }
   */
  async getPlayerPoolStats(playerId, poolId) {
    const result = await this.db.client.execute({
      sql: `SELECT
              COUNT(*) as handsPlayed,
              SUM(CASE WHEN winner = ? THEN 1 ELSE 0 END) as handsWon
            FROM hands WHERE poolId = ? AND winner = ?`,
      args: [playerId, poolId, playerId],
    });

    const row = result.rows[0];
    return {
      handsPlayed: row?.handsPlayed || 0,
      handsWon: row?.handsWon || 0,
      winRate:
        row?.handsPlayed > 0
          ? ((row.handsWon / row.handsPlayed) * 100).toFixed(2)
          : 0,
    };
  }

  /**
   * Get hand history for dispute resolution
   * Useful if players contest the outcome
   * @param {number} handId - Hand identifier
   * @returns {Promise<Object>} Full hand details with all actions
   */
  async getHandForAudit(handId) {
    return await this.db.getHandDetails(handId);
  }
}
