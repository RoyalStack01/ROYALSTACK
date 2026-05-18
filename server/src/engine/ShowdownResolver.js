/**
 * Resolves showdown: handles split pots, kickers, and multi-way ties.
 *
 * Should:
 * - Use HandEvaluator to rank each remaining player's hand
 * - For each side pot: find best hand(s) among eligible players
 * - Split pot equally among winners, handle remainder chip
 * - Return winners list, share amount, hand name for each pot
 *
 * Methods:
 * - resolve(activePlayers, communityCards, sidePots): Returns array of pot results
 * - _bestScore(evaluations): Find highest hand score among players
 *
 * Result format per pot:
 * { potAmount, winners: [playerId...], share, remainder, handName }
 */

// TODO: Import HandEvaluator and export as ES module
// TODO: Implement resolve(activePlayers, communityCards, sidePots)
// TODO: Implement hand evaluation for each player
// TODO: Implement per-pot winner determination
// TODO: Implement pot splitting logic with remainder handling
// TODO: Implement _bestScore(evaluations) helper


/**
 * ShowdownResolver.js
 * Resolves showdown: handles split pots, kickers, and multi-way ties.
 */

import { HandEvaluator } from './HandEvaluator.js';

export class ShowdownResolver {
  /**
   * Resolves the winner(s) for the main pot and all side pots.
   * @param {Array} activePlayers - All players who haven't folded.
   * @param {Array} communityCards - The 5 board cards.
   * @param {Array} sidePots - Array of pots: [{ amount, eligiblePlayerIds }]
   * @returns {Array} Array of resolution objects for each pot.
   */
  static resolve(activePlayers, communityCards, sidePots) {
    // 1. Evaluate every active player's best hand once
    const evaluations = activePlayers.map(player => {
      const fullHand = [...player.hand, ...communityCards];
      return {
        playerId: player.id,
        evaluation: HandEvaluator.evaluate(fullHand)
      };
    });

    // 2. Process each pot (Main pot is usually the first/last in the list)
    return sidePots.map(pot => {
      // Find evaluations only for players eligible for this specific pot
      const eligibleEvals = evaluations.filter(evalObj => 
        pot.eligiblePlayerIds.includes(evalObj.playerId)
      );

      if (eligibleEvals.length === 0) return null;

      // Determine the winning score in this pot
      const winningScore = this._bestScore(eligibleEvals);

      // Identify all players who share the winning score (Ties)
      const winners = eligibleEvals
        .filter(e => e.evaluation.score === winningScore)
        .map(e => ({
          id: e.playerId,
          handName: e.evaluation.name
        }));

      // 3. Split the pot
      const winnerCount = winners.length;
      const share = Math.floor(pot.amount / winnerCount);
      const remainder = pot.amount % winnerCount;

      return {
        potAmount: pot.amount,
        winners: winners.map(w => w.id),
        share: share,
        remainder: remainder,
        handName: winners[0].handName // Same hand rank for all winners of this pot
      };
    });
  }

  /**
   * Helper to find the maximum score in a set of evaluations.
   * @private
   */
  static _bestScore(evaluations) {
    return Math.max(...evaluations.map(e => e.evaluation.score));
  }
}