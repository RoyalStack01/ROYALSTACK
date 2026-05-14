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
