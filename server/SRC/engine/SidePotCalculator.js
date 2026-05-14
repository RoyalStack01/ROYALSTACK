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
