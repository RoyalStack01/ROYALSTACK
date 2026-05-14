/**
 * Evaluates the best 5-card hand from 7 cards using rank lookup.
 * Returns a numeric score — higher is better.
 *
 * Should:
 * - Generate all possible 5-card combinations from 7 cards
 * - Evaluate each combination for hand rank (royal flush down to high card)
 * - Compute a comparable score encoding rank + kicker values
 * - Return best hand with rank name and card list
 * - Handle wheel straight (A-2-3-4-5)
 *
 * Methods:
 * - evaluate(sevenCards): Returns { rank, name, cards, score }
 * - _evalFive(cards): Evaluate a single 5-card hand
 * - _isStraight(sortedValues): Check for straight including wheel
 * - _valueCounts(values): Count card values for pairs, trips, etc.
 * - _cardValue(card): Convert card string to numeric value
 * - _combinations(arr, k): Generate all k-combinations of array
 *
 * Hand ranks (high to low):
 * - Royal Flush, Straight Flush, Four of a Kind, Full House
 * - Flush, Straight, Three of a Kind, Two Pair
 * - One Pair, High Card
 */

// TODO: Import/export as ES module
// TODO: Define HAND_RANKS object
// TODO: Implement evaluate(sevenCards)
// TODO: Implement _evalFive(cards)
// TODO: Implement _score(rank, values) to create comparable integer
// TODO: Implement _isStraight(sortedValues)
// TODO: Implement _valueCounts(values)
// TODO: Implement _cardValue(card)
// TODO: Implement _combinations(arr, k) recursively


/**
 * HandEvaluator.js
 * Evaluates the best 5-card hand from 7 cards.
 */

const HAND_RANKS = {
  ROYAL_FLUSH: 9,
  STRAIGHT_FLUSH: 8,
  FOUR_OF_A_KIND: 7,
  FULL_HOUSE: 6,
  FLUSH: 5,
  STRAIGHT: 4,
  THREE_OF_A_KIND: 3,
  TWO_PAIR: 2,
  ONE_PAIR: 1,
  HIGH_CARD: 0
};

const RANK_MAP = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

export class HandEvaluator {
  /**
   * Evaluates the best 5-card hand from 7 cards.
   * @param {string[]} sevenCards - Array of 7 card strings (e.g., ['As', 'Th', ...])
   * @returns {Object} { rank, name, cards, score }
   */
  static evaluate(sevenCards) {
    const combos = this._combinations(sevenCards, 5);
    let bestHand = null;

    for (const combo of combos) {
      const result = this._evalFive(combo);
      if (!bestHand || result.score > bestHand.score) {
        bestHand = result;
      }
    }

    return bestHand;
  }

  /**
   * Core logic for a single 5-card hand
   */
  static _evalFive(cards) {
    const parsed = cards.map(c => ({ val: this._cardValue(c), suit: c[1], str: c }))
                        .sort((a, b) => b.val - a.val);
    
    const values = parsed.map(c => c.val);
    const suits = parsed.map(c => c.suit);
    const counts = this._valueCounts(values);
    const uniqueValues = [...new Set(values)];

    const isFlush = suits.every(s => s === suits[0]);
    const straightInfo = this._isStraight(uniqueValues);
    const isStraight = straightInfo.isStraight;

    // Rank logic
    if (isFlush && isStraight && values[0] === 14 && !straightInfo.isWheel) return this._result(HAND_RANKS.ROYAL_FLUSH, "Royal Flush", cards, values);
    if (isFlush && isStraight) return this._result(HAND_RANKS.STRAIGHT_FLUSH, "Straight Flush", cards, straightInfo.highCard);
    if (counts.counts[0] === 4) return this._result(HAND_RANKS.FOUR_OF_A_KIND, "Four of a Kind", cards, counts.ordered);
    if (counts.counts[0] === 3 && counts.counts[1] === 2) return this._result(HAND_RANKS.FULL_HOUSE, "Full House", cards, counts.ordered);
    if (isFlush) return this._result(HAND_RANKS.FLUSH, "Flush", cards, values);
    if (isStraight) return this._result(HAND_RANKS.STRAIGHT, "Straight", cards, straightInfo.highCard);
    if (counts.counts[0] === 3) return this._result(HAND_RANKS.THREE_OF_A_KIND, "Three of a Kind", cards, counts.ordered);
    if (counts.counts[0] === 2 && counts.counts[1] === 2) return this._result(HAND_RANKS.TWO_PAIR, "Two Pair", cards, counts.ordered);
    if (counts.counts[0] === 2) return this._result(HAND_RANKS.ONE_PAIR, "One Pair", cards, counts.ordered);

    return this._result(HAND_RANKS.HIGH_CARD, "High Card", cards, values);
  }

  static _isStraight(uniqueValues) {
    // Standard straight check
    for (let i = 0; i <= uniqueValues.length - 5; i++) {
      if (uniqueValues[i] - uniqueValues[i + 4] === 4) {
        return { isStraight: true, highCard: [uniqueValues[i]], isWheel: false };
      }
    }
    // Wheel (A-2-3-4-5)
    const wheel = [14, 5, 4, 3, 2];
    if (wheel.every(v => uniqueValues.includes(v))) {
      return { isStraight: true, highCard: [5], isWheel: true };
    }
    return { isStraight: false };
  }

  static _valueCounts(values) {
    const countsMap = {};
    values.forEach(v => countsMap[v] = (countsMap[v] || 0) + 1);
    
    // Sort by count (primary) then by value (secondary)
    const ordered = Object.keys(countsMap)
      .map(Number)
      .sort((a, b) => countsMap[b] - countsMap[a] || b - a);
    
    const counts = ordered.map(v => countsMap[v]);
    return { ordered, counts };
  }

  static _result(rank, name, cards, scoreValues) {
    return { rank, name, cards, score: this._calculateScore(rank, scoreValues) };
  }

  /**
   * Encodes hand into a comparable integer.
   * Format (Hex): [Rank][V1][V2][V3][V4][V5]
   */
  static _calculateScore(rank, values) {
    let score = rank;
    for (let i = 0; i < 5; i++) {
      const v = values[i] || 0;
      score = (score << 4) + v;
    }
    return score;
  }

  static _cardValue(card) {
    return RANK_MAP[card[0]];
  }

  static _combinations(arr, k) {
    if (k === 0) return [[]];
    if (arr.length === 0) return [];
    const [first, ...rest] = arr;
    const withFirst = this._combinations(rest, k - 1).map(c => [first, ...c]);
    const withoutFirst = this._combinations(rest, k);
    return [...withFirst, ...withoutFirst];
  }
}