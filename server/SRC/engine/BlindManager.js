/**
 * Manages dealer button rotation and automatic SB/BB posting.
 */

class BlindManager {
  constructor({ smallBlindAmount, bigBlindAmount }) {
    this.smallBlindAmount = smallBlindAmount;
    this.bigBlindAmount = bigBlindAmount;
  }

  /**
   * Rotates the dealer button and posts blinds.
   * @param {Array<{ id: string, stack: number, seatIndex: number }>} players
   * @param {number} [prevDealerIndex=-1]
   * @returns {{ dealerIndex, smallBlind: { seatIndex, amount }, bigBlind: { seatIndex, amount } }}
   */
  postBlinds(players, prevDealerIndex = -1) {
    const count = players.length;
    const dealerIndex = (prevDealerIndex + 1) % count;
    const sbIndex = (dealerIndex + 1) % count;
    const bbIndex = (dealerIndex + 2) % count;

    const sbAmount = Math.min(this.smallBlindAmount, players[sbIndex].stack);
    const bbAmount = Math.min(this.bigBlindAmount, players[bbIndex].stack);

    players[sbIndex].stack -= sbAmount;
    players[sbIndex].betThisStreet = sbAmount;
    players[bbIndex].stack -= bbAmount;
    players[bbIndex].betThisStreet = bbAmount;

    if (players[sbIndex].stack === 0) players[sbIndex].allIn = true;
    if (players[bbIndex].stack === 0) players[bbIndex].allIn = true;

    return {
      dealerIndex,
      smallBlind: { seatIndex: sbIndex, playerId: players[sbIndex].id, amount: sbAmount },
      bigBlind: { seatIndex: bbIndex, playerId: players[bbIndex].id, amount: bbAmount },
    };
  }

  /**
   * Returns the seat index of the first player to act post-flop (left of dealer).
   */
  firstToAct(players, dealerIndex) {
    const count = players.length;
    let idx = (dealerIndex + 1) % count;
    while (players[idx].folded || players[idx].allIn) {
      idx = (idx + 1) % count;
      if (idx === dealerIndex) break;
    }
    return idx;
  }
}

module.exports = BlindManager;
