import Deck from './Deck.js';
import BlindManager from './BlindManager.js';
import ActionValidator from './ActionValidator.js';
import ShowdownResolver from './ShowdownResolver.js';

const PHASE = {
    WAITING: 'waiting',
    PREFLOP: 'preflop',
    FLOP: 'flop',
    TURN: 'turn',
    RIVER: 'river',
    SHOWDOWN: 'showdown',
    FINISHED: 'finished',
};

const clampPositiveInteger = (value, fallback = 0) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || Math.floor(number) !== number) {
        return fallback;
    }
    return number;
};

const isPlayerActive = (player) => Boolean(player && !player.folded && !player.allIn);

export default class GameStateMachine {
    constructor({ smallBlind, bigBlind, ante, minPlayers = 2 } = {}) {
        this.deck = new Deck();
        this.blindManager = new BlindManager({ smallBlind, bigBlind, ante });
        this.players = [];
        this.buttonIndex = -1;
        this.currentActor = -1;
        this.phase = PHASE.WAITING;
        this.board = [];
        this.pot = 0;
        this.roundBet = 0;
        this.minRaise = this.blindManager.bigBlind;
        this.lastAggressor = -1;
        this.minPlayers = clampPositiveInteger(minPlayers, 2);
    }

    addPlayer(player) {
        if (!player || typeof player.id === 'undefined') {
            throw new Error('Player must have an id.');
        }
        this.players.push({
            ...player,
            chips: clampPositiveInteger(player.chips, 0),
            currentBet: 0,
            folded: false,
            allIn: false,
            holeCards: player.holeCards ?? [],
            hasActed: false,
        });
        return this;
    }

    removePlayer(id) {
        this.players = this.players.filter((player) => player.id !== id);
        return this;
    }

    getActivePlayers() {
        return this.players.filter((player) => !player.folded);
    }

    canStartHand() {
        return this.players.filter((player) => player.chips > 0).length >= this.minPlayers;
    }

    resetHandState() {
        this.board = [];
        this.pot = 0;
        this.roundBet = 0;
        this.minRaise = this.blindManager.bigBlind;
        this.lastAggressor = -1;
        this.currentActor = -1;
        this.players = this.players.map((player) => ({
            ...player,
            currentBet: 0,
            folded: false,
            allIn: false,
            hasActed: false,
            holeCards: [],
        }));
    }

    startHand() {
        if (!this.canStartHand()) {
            throw new Error('Not enough players with chips to start a hand.');
        }

        this.deck.reset().shuffle();
        this.resetHandState();

        this.buttonIndex = this.blindManager.advanceButton(this.players, this.buttonIndex);
        if (this.buttonIndex === -1) {
            this.buttonIndex = this.blindManager.getButtonIndex(this.players, this.buttonIndex);
        }

        const blindResult = this.blindManager.applyBlinds(this.players, this.buttonIndex);
        this.players = blindResult.players;
        this.roundBet = blindResult.roundBet;
        this.pot = blindResult.blinds.smallBlind + blindResult.blinds.bigBlind + blindResult.blinds.ante;
        this.minRaise = this.blindManager.bigBlind;
        this.phase = PHASE.PREFLOP;

        this.dealHoleCards();
        this.startBettingRound(blindResult.positions.bigBlindIndex);

        return blindResult;
    }

    dealHoleCards() {
        this.players = this.players.map((player) => ({
            ...player,
            holeCards: [],
        }));

        for (let i = 0; i < 2; i += 1) {
            for (const player of this.players) {
                if (player.chips === 0) {
                    continue;
                }
                const card = this.deck.draw();
                if (!card) break;
                player.holeCards = [...player.holeCards, card];
            }
        }
    }

    startBettingRound(startIndex = -1) {
        this.players = this.players.map((player) => ({
            ...player,
            hasActed: player.folded || player.allIn,
        }));

        if (startIndex === -1) {
            startIndex = this.getNextActor(this.buttonIndex);
        } else {
            startIndex = this.getNextActor(startIndex);
        }

        this.currentActor = startIndex;
    }

    getNextActor(fromIndex) {
        const count = this.players.length;
        if (count === 0) return -1;

        for (let offset = 1; offset <= count; offset += 1) {
            const index = (fromIndex + offset) % count;
            const player = this.players[index];
            if (player && !player.folded && !player.allIn && !player.hasActed) {
                return index;
            }
        }
        return -1;
    }

    processAction(playerId, action) {
        const playerIndex = this.players.findIndex((player) => player.id === playerId);
        if (playerIndex === -1) {
            throw new Error('Player not found.');
        }

        const player = this.players[playerIndex];
        if (player.folded || player.allIn) {
            throw new Error('Player cannot act after folding or going all-in.');
        }

        const validation = ActionValidator.validate(action, player, {
            roundBet: this.roundBet,
            bigBlind: this.blindManager.bigBlind,
            minRaise: this.minRaise,
        });
        if (!validation.valid) {
            throw new Error(validation.reason);
        }

        const amount = validation.amount ?? 0;
        const previousBet = player.currentBet;
        const investment = amount - previousBet;

        if (action.type === ActionValidator.ACTION_TYPES.FOLD) {
            this.players[playerIndex] = { ...player, folded: true, hasActed: true };
        } else if (action.type === ActionValidator.ACTION_TYPES.CHECK) {
            this.players[playerIndex] = { ...player, hasActed: true };
        } else if (action.type === ActionValidator.ACTION_TYPES.CALL) {
            const callAmount = Math.min(this.roundBet - player.currentBet, player.chips);
            this.players[playerIndex] = {
                ...player,
                chips: player.chips - callAmount,
                currentBet: player.currentBet + callAmount,
                hasActed: true,
                allIn: player.chips - callAmount === 0,
            };
            this.pot += callAmount;
        } else if (action.type === ActionValidator.ACTION_TYPES.BET || action.type === ActionValidator.ACTION_TYPES.RAISE || action.type === ActionValidator.ACTION_TYPES.ALL_IN) {
            const nextBet = amount;
            const incoming = nextBet - player.currentBet;
            this.players[playerIndex] = {
                ...player,
                chips: player.chips - incoming,
                currentBet: nextBet,
                hasActed: true,
                allIn: player.chips - incoming === 0,
            };
            this.pot += incoming;
            if (nextBet > this.roundBet) {
                this.minRaise = Math.max(this.minRaise, nextBet - this.roundBet);
                this.roundBet = nextBet;
                this.lastAggressor = playerIndex;
                this.players = this.players.map((entry, index) => {
                    if (index === playerIndex || entry.folded || entry.allIn) {
                        return entry;
                    }
                    return { ...entry, hasActed: false };
                });
            }
        }

        if (this.isHandFinished()) {
            return this.completeHand();
        }

        if (this.isBettingRoundComplete()) {
            this.advanceStreet();
            return this.getState();
        }

        this.currentActor = this.getNextActor(playerIndex);
        if (this.currentActor === -1) {
            if (this.isBettingRoundComplete()) {
                this.advanceStreet();
            }
        }

        return this.getState();
    }

    isBettingRoundComplete() {
        const activePlayers = this.players.filter((player) => !player.folded && !player.allIn);
        if (activePlayers.length === 0) {
            return true;
        }
        return activePlayers.every((player) => player.hasActed);
    }

    advanceStreet() {
        if (this.phase === PHASE.PREFLOP) {
            this.phase = PHASE.FLOP;
            this.deck.burn(1);
            this.board = [...this.board, ...this.deck.draw(3)];
        } else if (this.phase === PHASE.FLOP) {
            this.phase = PHASE.TURN;
            this.deck.burn(1);
            this.board = [...this.board, ...this.deck.draw(1)];
        } else if (this.phase === PHASE.TURN) {
            this.phase = PHASE.RIVER;
            this.deck.burn(1);
            this.board = [...this.board, ...this.deck.draw(1)];
        } else if (this.phase === PHASE.RIVER) {
            this.phase = PHASE.SHOWDOWN;
            return this.completeHand();
        }

        this.players = this.players.map((player) => ({
            ...player,
            hasActed: player.folded || player.allIn,
        }));
        this.currentActor = this.getNextActor(this.buttonIndex);
        this.roundBet = 0;
        this.minRaise = this.blindManager.bigBlind;
        return this.getState();
    }

    isHandFinished() {
        const activePlayers = this.players.filter((player) => !player.folded);
        return activePlayers.length <= 1;
    }

    completeHand() {
        this.phase = PHASE.SHOWDOWN;
        const results = ShowdownResolver.determinePotWinners(this.players, this.board);
        this.phase = PHASE.FINISHED;
        return {
            phase: this.phase,
            board: this.board,
            pot: this.pot,
            results,
        };
    }

    getState() {
        return {
            phase: this.phase,
            board: this.board,
            pot: this.pot,
            roundBet: this.roundBet,
            minRaise: this.minRaise,
            currentActor: this.currentActor,
            buttonIndex: this.buttonIndex,
            players: this.players,
        };
    }
}
