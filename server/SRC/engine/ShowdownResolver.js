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
