/**
 * Manages dealer button rotation and automatic SB/BB posting.
 *
 * Should:
 * - Rotate dealer button: (prevDealer + 1) % playerCount
 * - Post SB to next player after dealer
 * - Post BB to next player after SB
 * - Deduct blind amounts from player stacks
 * - Mark players as all-in if stack becomes 0
 * - Provide first-to-act index for post-flop streets (left of dealer, skip folded/all-in)
 *
 * Methods:
 * - constructor(smallBlindAmount, bigBlindAmount)
 * - postBlinds(players, prevDealerIndex): Returns { dealerIndex, smallBlind, bigBlind }
 * - firstToAct(players, dealerIndex): Returns seat index of first active player
 */

// TODO: Import/export as ES module
// TODO: Implement constructor(smallBlindAmount, bigBlindAmount)
// TODO: Implement postBlinds(players, prevDealerIndex)
// TODO: Implement blind deduction and all-in marking
// TODO: Implement firstToAct(players, dealerIndex) with folded/all-in skipping

/**
 * BlindManager.js
 * Manages dealer button rotation, automatic SB/BB posting, and positional logic.
 */

export class BlindManager {
  /**
   * @param {number} smallBlindAmount
   * @param {number} bigBlindAmount
   */
  constructor(smallBlindAmount, bigBlindAmount) {
    this.smallBlindAmount = smallBlindAmount;
    this.bigBlindAmount = bigBlindAmount;
  }

  /**
   * Rotates dealer and deducts blinds from player stacks.
   * @param {Array} players - Array of player objects
   * @param {number} prevDealerIndex - Index of the dealer from the last hand
   * @returns {Object} { dealerIndex, sbIndex, bbIndex }
   */
  postBlinds(players, prevDealerIndex) {
    const playerCount = players.length;
    if (playerCount < 2) throw new Error("At least 2 players required.");

    // 1. Rotate Dealer Button
    const dealerIndex = (prevDealerIndex + 1) % playerCount;

    // 2. Identify SB and BB positions
    // In heads-up (2 players), dealer is SB, next is BB.
    // In standard (3+ players), next after dealer is SB, next is BB.
    let sbIndex, bbIndex;
    if (playerCount === 2) {
      sbIndex = dealerIndex;
      bbIndex = (dealerIndex + 1) % playerCount;
    } else {
      sbIndex = (dealerIndex + 1) % playerCount;
      bbIndex = (dealerIndex + 2) % playerCount;
    }

    // 3. Post Blinds (Deduct from stacks)
    this._deductBlind(players[sbIndex], this.smallBlindAmount);
    this._deductBlind(players[bbIndex], this.bigBlindAmount);

    return {
      dealerIndex,
      sbIndex,
      bbIndex,
      smallBlind: this.smallBlindAmount,
      bigBlind: this.bigBlindAmount
    };
  }

  /**
   * Finds the first active player left of the dealer for post-flop streets.
   * @param {Array} players - Array of player objects
   * @param {number} dealerIndex - Current dealer index
   * @returns {number} Seat index of the first active player
   */
  firstToAct(players, dealerIndex) {
    const playerCount = players.length;
    
    // Check every seat starting from the one left of the dealer
    for (let i = 1; i <= playerCount; i++) {
      const currentIndex = (dealerIndex + i) % playerCount;
      const player = players[currentIndex];

      // Skip players who are folded or out of chips (all-in)
      if (!player.folded && player.stack > 0) {
        return currentIndex;
      }
    }
    
    return -1; // No active players found
  }

  /**
   * Internal helper to handle blind deduction and All-In state
   * @private
   */
  _deductBlind(player, amount) {
    // Determine actual amount to deduct (cannot deduct more than stack)
    const actualDeduction = Math.min(player.stack, amount);
    
    player.stack -= actualDeduction;
    player.betThisStreet = (player.betThisStreet || 0) + actualDeduction;

    // Mark as all-in if they hit 0
    if (player.stack === 0) {
      player.isAllIn = true;
    }
  }
}