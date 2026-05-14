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


/**
 * GameStateMachine.js
 * Drives preflop → flop → turn → river → showdown transitions.
 */

const STAGES = ['preflop', 'flop', 'turn', 'river', 'showdown'];

export class GameStateMachine {
  constructor({ deck, blindManager, actionValidator, showdownResolver, sidePotCalculator }) {
    this.deck = deck;
    this.blindManager = blindManager;
    this.actionValidator = actionValidator;
    this.showdownResolver = showdownResolver; // Placeholder for logic
    this.sidePotCalculator = sidePotCalculator; // Placeholder for logic
    this.state = null;
  }

  /**
   * Initializes a fresh hand.
   */
  startHand(players, seed) {
    this.deck.shuffle(seed);
    
    // Initialize state
    this.state = {
      players: players.map(p => ({
        ...p,
        folded: false,
        isAllIn: false,
        betThisStreet: 0,
        hand: []
      })),
      stage: 'preflop',
      communityCards: [],
      pot: 0,
      currentBet: 0,
      lastRaiseAmount: 0,
      activePlayerId: null,
      dealerIndex: this.state ? this.state.dealerIndex : -1, 
    };

    // 1. Post Blinds
    const blindInfo = this.blindManager.postBlinds(this.state.players, this.state.dealerIndex);
    this.state.dealerIndex = blindInfo.dealerIndex;
    this.state.currentBet = blindInfo.bigBlind;
    this.state.lastRaiseAmount = blindInfo.bigBlind;

    // 2. Deal Cards
    this._dealHoleCards();

    // 3. Set first actor (Under the Gun)
    // Preflop: Person after Big Blind acts first.
    const bbIndex = blindInfo.bbIndex;
    this.state.activePlayerId = this.state.players[(bbIndex + 1) % this.state.players.length].id;

    return this.state;
  }

  /**
   * Processes a player action and advances the game.
   */
  applyAction(playerId, action) {
    const validation = this.actionValidator.validate(this.state, playerId, action);
    if (!validation.valid) return { error: validation.reason };

    this._mutateState(playerId, action);

    if (this._isStreetOver()) {
      this._advance();
    } else {
      this.state.activePlayerId = this._nextActivePlayer(this.state.activePlayerId);
    }

    return this.state;
  }

  _mutateState(playerId, action) {
    const player = this.state.players.find(p => p.id === playerId);
    
    switch (action.type) {
      case 'fold':
        player.folded = true;
        break;
      case 'check':
        break;
      case 'call':
        const callAmount = this.state.currentBet - player.betThisStreet;
        this._executeTransfer(player, callAmount);
        break;
      case 'bet':
      case 'raise':
        const raiseAmount = action.amount - player.betThisStreet;
        this.state.lastRaiseAmount = action.amount - this.state.currentBet;
        this.state.currentBet = action.amount;
        this._executeTransfer(player, raiseAmount);
        break;
    }
    player.lastAction = action.type;
  }

  _executeTransfer(player, amount) {
    const actual = Math.min(player.stack, amount);
    player.stack -= actual;
    player.betThisStreet += actual;
    this.state.pot += actual;
    if (player.stack === 0) player.isAllIn = true;
  }

  _isStreetOver() {
    const activePlayers = this.state.players.filter(p => !p.folded && !p.isAllIn);
    
    // If only one person left with cards, hand is over
    if (this.state.players.filter(p => !p.folded).length <= 1) return true;

    // Street is over if everyone has matched the current bet (or is all-in)
    return activePlayers.every(p => p.betThisStreet === this.state.currentBet && p.lastAction !== undefined);
  }

  _advance() {
    const currentIndex = STAGES.indexOf(this.state.stage);
    this._resetActionsForStreet();

    if (this.state.stage === 'river' || this.state.players.filter(p => !p.folded).length <= 1) {
      this._resolveShowdown();
    } else {
      this.state.stage = STAGES[currentIndex + 1];
      
      // Deal community cards
      if (this.state.stage === 'flop') this.state.communityCards.push(...this.deck.deal(3));
      if (this.state.stage === 'turn') this.state.communityCards.push(...this.deck.deal(1));
      if (this.state.stage === 'river') this.state.communityCards.push(...this.deck.deal(1));

      // Post-flop, first to act is left of dealer
      const firstIndex = this.blindManager.firstToAct(this.state.players, this.state.dealerIndex);
      this.state.activePlayerId = this.state.players[firstIndex].id;
    }
  }

  _resolveShowdown() {
    this.state.stage = 'showdown';
    // Integration point: result = this.showdownResolver.resolve(this.state);
    // Integration point: this.sidePotCalculator.distribute(result);
  }

  _dealHoleCards() {
    this.state.players.forEach(p => {
      p.hand = this.deck.deal(2);
    });
  }

  _nextActivePlayer(currentId) {
    const currentIndex = this.state.players.findIndex(p => p.id === currentId);
    for (let i = 1; i < this.state.players.length; i++) {
      const idx = (currentIndex + i) % this.state.players.length;
      const p = this.state.players[idx];
      if (!p.folded && !p.isAllIn) return p.id;
    }
    return null;
  }

  _resetActionsForStreet() {
    this.state.currentBet = 0;
    this.state.lastRaiseAmount = 0;
    this.state.players.forEach(p => {
      p.betThisStreet = 0;
      delete p.lastAction;
    });
  }
}