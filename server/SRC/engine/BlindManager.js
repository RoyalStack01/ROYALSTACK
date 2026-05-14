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
