/**
 * Resolves all-in multi-pot scenarios.
 * Returns an ordered array of side pots, each capped at the all-in player's contribution.
 *
 * Should:
 * - Sort all player bet amounts to identify all-in thresholds
 * - Create a main pot up to the smallest all-in amount
 * - Create side pots for each subsequent all-in threshold
 * - Mark which players are eligible for each pot (based on their bet amount)
 * - Handle fold equity: chips from folded players flow to remaining pots
 *
 * Methods:
 * - calculate(players): Returns array of { amount, eligible: [playerIds] }
 * - _absorbFoldedChips(pots, players): Add folded player chips to last eligible pot
 */

// TODO: Import/export as ES module
// TODO: Implement calculate(players)
// TODO: Implement pot creation for each all-in level
// TODO: Implement eligible player tracking per pot
// TODO: Implement _absorbFoldedChips(pots, players)


/**
 * SidePotCalculator.js
 * Resolves all-in multi-pot scenarios by creating layered pots.
 */

export class SidePotCalculator {
  /**
   * Calculates the division of the total pot into main and side pots.
   * @param {Array} players - Array of player objects. 
   * Each player must have: { id, totalHandContribution, folded }
   * @returns {Array} Array of { amount, eligiblePlayerIds }
   */
  static calculate(players) {
    // 1. Get all unique contribution amounts from players who haven't folded
    // and those who have (to account for dead money).
    const contributors = players.filter(p => p.totalHandContribution > 0);
    
    if (contributors.length === 0) return [];

    // 2. Sort unique contribution levels in ascending order
    const levels = [...new Set(contributors.map(p => p.totalHandContribution))]
      .sort((a, b) => a - b);

    let pots = [];
    let previousLevel = 0;

    // 3. Create "layers" of pots based on these levels
    for (const level of levels) {
      const contributionInThisLayer = level - previousLevel;
      let potAmount = 0;
      let eligiblePlayerIds = [];

      for (const p of contributors) {
        // Calculate how much this player contributes to this specific layer
        const contribution = Math.min(
          Math.max(0, p.totalHandContribution - previousLevel),
          contributionInThisLayer
        );
        
        potAmount += contribution;

        // A player is eligible for this pot only if they contributed to this layer
        // AND they haven't folded.
        if (p.totalHandContribution >= level && !p.folded) {
          eligiblePlayerIds.push(p.id);
        }
      }

      if (potAmount > 0) {
        pots.push({
          amount: potAmount,
          eligiblePlayerIds: eligiblePlayerIds
        });
      }

      previousLevel = level;
    }

    // 4. Handle edge cases where folded chips need to be merged
    return this._absorbFoldedChips(pots);
  }

  /**
   * Merges adjacent pots that have the exact same eligibility list.
   * This often happens when a player folds or when non-all-in players
   * match each other's bets.
   * @private
   */
  static _absorbFoldedChips(pots) {
    if (pots.length <= 1) return pots;

    const mergedPots = [];
    
    for (const currentPot of pots) {
      if (mergedPots.length === 0) {
        mergedPots.push(currentPot);
        continue;
      }

      const lastPot = mergedPots[mergedPots.length - 1];

      // Check if the eligibility lists are identical
      const isSameEligibility = 
        lastPot.eligiblePlayerIds.length === currentPot.eligiblePlayerIds.length &&
        lastPot.eligiblePlayerIds.every(id => currentPot.eligiblePlayerIds.includes(id));

      if (isSameEligibility) {
        // Merge this pot into the previous one
        lastPot.amount += currentPot.amount;
      } else if (currentPot.eligiblePlayerIds.length === 0) {
        // Dead money pot: No one is eligible. 
        // In a real game, this shouldn't happen if the last person remaining wins,
        // but as a fallback, we give it to the "most eligible" previous pot.
        lastPot.amount += currentPot.amount;
      } else {
        mergedPots.push(currentPot);
      }
    }

    return mergedPots;
  }
}