/**
 * Validates player actions against current game state.
 * Returns { valid: boolean, reason?: string }.
 *
 * Should:
 * - Check that player exists and is not folded
 * - Check that it's the player's turn
 * - Validate action type and parameters
 * - For fold: always valid if player hasn't acted yet
 * - For check: valid only if currentBet == 0 or matches player's betThisStreet
 * - For call: valid only if there's an active bet to match
 * - For bet: valid only if currentBet == 0 and amount > 0 and <= stack
 * - For raise: valid only if currentBet > 0 and raise >= 2x bet and <= stack
 *
 * Methods:
 * - validate(state, playerId, action): Returns { valid, reason? }
 * - _invalid(reason): Helper to create error response
 */

// TODO: Import/export as ES module
// TODO: Implement validate(state, playerId, action)
// TODO: Implement player existence check
// TODO: Implement turn order verification
// TODO: Implement fold validation
// TODO: Implement check validation
// TODO: Implement call validation
// TODO: Implement bet validation
// TODO: Implement raise validation
// TODO: Implement _invalid(reason) helper
