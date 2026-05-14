/**
 * Drives preflop → flop → turn → river → showdown transitions.
 * Pure logic — no I/O, no chain calls.
 *
 * Should:
 * - Manage game stage progression through all streets
 * - Initialize a fresh hand with deck shuffle, blind posting, hole card dealing
 * - Apply player actions (fold, check, call, bet, raise) and validate via ActionValidator
 * - Detect when a street is complete (all players acted, bets matched)
 * - Advance to next street (deal community cards: 3 for flop, 1 for turn/river)
 * - Trigger showdown at river completion
 * - Track active player index, current bet, pot
 * - Delegate hand evaluation and pot resolution to ShowdownResolver and SidePotCalculator
 *
 * Methods:
 * - constructor({ deck, blindManager, turnTimer, actionValidator, showdownResolver, sidePotCalculator })
 * - startHand(players, poolId): Initialize fresh hand, return state
 * - applyAction(playerId, action): Process and return updated state
 * - _advance(): Progress to next street
 * - _resolveShowdown(): End hand and calculate winners
 * - _dealHoleCards(): Deal 2 cards to each player
 * - _mutateState(playerId, action): Update state for fold/check/call/bet/raise
 * - _isStreetOver(): Detect street completion
 * - _nextActivePlayer(): Find next player to act (skip folded/all-in)
 * - _resetActionsForStreet(): Reset action flags and bets for new street
 */

// TODO: Import dependencies (Deck, BlindManager, TurnTimer, ActionValidator, ShowdownResolver, SidePotCalculator)
// TODO: Export as ES module
// TODO: Define STAGES constant: ['preflop', 'flop', 'turn', 'river', 'showdown']
// TODO: Implement constructor
// TODO: Implement startHand(players, poolId)
// TODO: Implement applyAction(playerId, action)
// TODO: Implement _advance() with stage-specific logic
// TODO: Implement _resolveShowdown()
// TODO: Implement _dealHoleCards()
// TODO: Implement _mutateState(playerId, action) for each action type
// TODO: Implement _isStreetOver()
// TODO: Implement _nextActivePlayer()
// TODO: Implement _resetActionsForStreet()
