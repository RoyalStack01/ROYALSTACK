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


/**
 * ActionValidator.js
 * Validates player actions against current game state.
 * Returns { valid: boolean, reason?: string }.
 */

export class ActionValidator {
  /**
   * Main entry point for validation
   * @param {Object} state - The current game state
   * @param {string} playerId - ID of the player attempting the action
   * @param {Object} action - { type: 'fold'|'check'|'call'|'bet'|'raise', amount: number }
   */
  static validate(state, playerId, action) {
    const player = state.players.find(p => p.id === playerId);

    // 1. Basic Existence and Status Checks
    if (!player) {
      return this._invalid("Player not found in current game.");
    }

    if (player.folded) {
      return this._invalid("Player has already folded.");
    }

    if (state.activePlayerId !== playerId) {
      return this._invalid("It is not this player's turn.");
    }

    // 2. Action Type Routing
    switch (action.type.toLowerCase()) {
      case 'fold':
        return this._validateFold(player);
      
      case 'check':
        return this._validateCheck(state, player);
      
      case 'call':
        return this._validateCall(state, player);
      
      case 'bet':
        return this._validateBet(state, player, action.amount);
      
      case 'raise':
        return this._validateRaise(state, player, action.amount);
      
      default:
        return this._invalid(`Unknown action type: ${action.type}`);
    }
  }

  // --- Validation Helpers ---

  static _validateFold(player) {
    // Fold is always a legal move if it's your turn
    return { valid: true };
  }

  static _validateCheck(state, player) {
    // Valid only if there is no bet to call
    const amountToCall = state.currentBet - (player.betThisStreet || 0);
    if (amountToCall > 0) {
      return this._invalid("Cannot check; there is an outstanding bet.");
    }
    return { valid: true };
  }

  static _validateCall(state, player) {
    const amountToCall = state.currentBet - (player.betThisStreet || 0);
    if (amountToCall <= 0) {
      return this._invalid("Nothing to call. Use 'check' instead.");
    }
    if (player.stack < amountToCall) {
      // In a real app, this might trigger an "All-in" logic
      return this._invalid("Insufficient chips to call.");
    }
    return { valid: true };
  }

  static _validateBet(state, player, amount) {
    if (state.currentBet > 0) {
      return this._invalid("A bet has already been placed. Use 'raise' instead.");
    }
    if (amount <= 0) {
      return this._invalid("Bet amount must be greater than 0.");
    }
    if (amount > player.stack) {
      return this._invalid("Bet exceeds player stack.");
    }
    // Optional: Add Small/Big Blind minimum bet logic here
    return { valid: true };
  }

  static _validateRaise(state, player, totalAmount) {
    // Post-flop open bet: no prior bet on this street — treat raise as bet
    if (state.currentBet === 0) {
      return this._validateBet(state, player, totalAmount);
    }

    const minRaise = state.lastRaiseAmount
      ? state.currentBet + state.lastRaiseAmount
      : state.currentBet * 2;

    if (totalAmount < minRaise) {
      return this._invalid(`Raise must be at least ${minRaise}.`);
    }
    if (totalAmount > player.stack + (player.betThisStreet || 0)) {
      return this._invalid("Raise exceeds player stack.");
    }
    return { valid: true };
  }

  /**
   * Helper to create error response
   */
  static _invalid(reason) {
    return { valid: false, reason };
  }
}