const ACTION_TYPES = Object.freeze({
    FOLD: 'fold',
    CHECK: 'check',
    CALL: 'call',
    BET: 'bet',
    RAISE: 'raise',
    ALL_IN: 'allin',
});

const normalizeType = (type) => {
    if (!type) return undefined;
    return String(type).trim().toLowerCase();
};

const toPositiveInteger = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0 || Math.floor(number) !== number) {
        return undefined;
    }
    return number;
};

const getRoundBet = (gameState) => Number(gameState?.roundBet ?? 0);
const getCurrentBet = (playerState) => Number(playerState?.currentBet ?? 0);
const getChips = (playerState) => Number(playerState?.chips ?? 0);
const getMinRaise = (gameState) => {
    const minRaise = Number(gameState?.minRaise ?? gameState?.bigBlind ?? 0);
    return minRaise > 0 ? minRaise : 1;
};

const buildError = (message) => ({ valid: false, reason: message });

export default class ActionValidator {
    static ACTION_TYPES = ACTION_TYPES;

    static isValidType(rawType) {
        const type = normalizeType(rawType);
        return Object.values(ACTION_TYPES).includes(type);
    }

    static getCallAmount(playerState, gameState) {
        const roundBet = getRoundBet(gameState);
        const currentBet = getCurrentBet(playerState);
        return Math.max(0, roundBet - currentBet);
    }

    static getMinRaiseAmount(gameState) {
        const roundBet = getRoundBet(gameState);
        const minRaise = getMinRaise(gameState);
        return roundBet > 0 ? roundBet + minRaise : minRaise;
    }

    static getLegalActions(playerState, gameState) {
        if (!playerState || playerState.folded || playerState.allIn) {
            return [];
        }

        const chips = getChips(playerState);
        const roundBet = getRoundBet(gameState);
        const currentBet = getCurrentBet(playerState);
        const callAmount = Math.max(0, roundBet - currentBet);
        const minRaiseAmount = ActionValidator.getMinRaiseAmount(gameState);
        const legal = [];

        if (playerState.folded || playerState.allIn) {
            return [];
        }

        if (roundBet === currentBet) {
            legal.push({ type: ACTION_TYPES.CHECK });
        }

        if (roundBet > currentBet && chips > 0) {
            legal.push({
                type: ACTION_TYPES.CALL,
                amount: Math.min(callAmount, chips),
            });
        }

        if (roundBet === 0 && chips > 0) {
            legal.push({
                type: ACTION_TYPES.BET,
                amount: Math.min(chips, minRaiseAmount),
            });
        }

        if (roundBet > 0 && chips > 0) {
            const raiseTarget = currentBet + chips;
            if (raiseTarget >= minRaiseAmount) {
                legal.push({
                    type: ACTION_TYPES.RAISE,
                    amount: Math.min(raiseTarget, chips + currentBet),
                });
            }
        }

        if (chips > 0) {
            legal.push({
                type: ACTION_TYPES.ALL_IN,
                amount: chips,
            });
        }

        legal.push({ type: ACTION_TYPES.FOLD });

        return legal;
    }

    static validate(action, playerState, gameState) {
        if (!action || typeof action !== 'object') {
            return buildError('Action must be an object with a valid type.');
        }

        const type = normalizeType(action.type);
        if (!ActionValidator.isValidType(type)) {
            return buildError(`Invalid action type: ${action.type}`);
        }

        if (!playerState) {
            return buildError('Player state is required for validation.');
        }

        if (playerState.folded) {
            return buildError('Player has already folded.');
        }

        if (playerState.allIn) {
            return buildError('Player is already all-in and cannot take further actions.');
        }

        const chips = getChips(playerState);
        const roundBet = getRoundBet(gameState);
        const currentBet = getCurrentBet(playerState);
        const callAmount = Math.max(0, roundBet - currentBet);
        const minRaiseAmount = ActionValidator.getMinRaiseAmount(gameState);

        if (chips <= 0 && type !== ACTION_TYPES.FOLD) {
            return buildError('Player has no chips remaining and can only fold.');
        }

        switch (type) {
            case ACTION_TYPES.FOLD:
                return { valid: true, type };

            case ACTION_TYPES.CHECK:
                if (roundBet !== currentBet) {
                    return buildError('Check is only allowed when the player has already matched the current bet.');
                }
                return { valid: true, type };

            case ACTION_TYPES.CALL:
                if (roundBet <= currentBet) {
                    return buildError('Call is only allowed when the current bet is higher than the player\'s bet.');
                }
                if (chips <= 0) {
                    return buildError('No chips available to call.');
                }
                return {
                    valid: true,
                    type,
                    amount: Math.min(callAmount, chips),
                };

            case ACTION_TYPES.BET: {
                if (roundBet > 0) {
                    return buildError('Bet is only allowed when no bet has been made in the current round.');
                }

                const amount = toPositiveInteger(action.amount);
                if (amount === undefined) {
                    return buildError('Bet amount must be a positive integer.');
                }
                if (amount > chips) {
                    return buildError('Bet amount cannot exceed available chips.');
                }
                if (amount < minRaiseAmount) {
                    return buildError(`Bet amount must be at least ${minRaiseAmount}.`);
                }
                return { valid: true, type, amount };
            }

            case ACTION_TYPES.RAISE: {
                if (roundBet === 0) {
                    return buildError('Cannot raise when no bet has been made. Use "bet" instead.');
                }

                const amount = toPositiveInteger(action.amount);
                if (amount === undefined) {
                    return buildError('Raise amount must be a positive integer.');
                }
                if (amount <= roundBet) {
                    return buildError('Raise amount must exceed the current round bet.');
                }
                if (amount > currentBet + chips) {
                    return buildError('Raise amount cannot exceed the player\'s total stack including current bet.');
                }
                if (amount < minRaiseAmount) {
                    return buildError(`Raise amount must be at least ${minRaiseAmount}.`);
                }
                return { valid: true, type, amount };
            }

            case ACTION_TYPES.ALL_IN: {
                const amount = toPositiveInteger(action.amount) ?? chips;
                if (amount !== chips) {
                    return buildError('All-in amount must equal the player\'s remaining chips.');
                }
                return { valid: true, type, amount };
            }

            default:
                return buildError(`Unsupported action type: ${action.type}`);
        }
    }

    static validateOrThrow(action, playerState, gameState) {
        const result = ActionValidator.validate(action, playerState, gameState);
        if (!result.valid) {
            throw new Error(result.reason);
        }
        return result;
    }
}
