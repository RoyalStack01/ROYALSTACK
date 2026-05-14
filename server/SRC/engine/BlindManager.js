const DEFAULT_SMALL_BLIND = 25;
const DEFAULT_BIG_BLIND = 50;

const clampPositiveInteger = (value, fallback = 0) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0 || Math.floor(number) !== number) {
        return fallback;
    }
    return number;
};

const isActivePlayer = (player) => {
    return Boolean(player && !player.folded && !player.sittingOut);
};

const getNextIndex = (players, startIndex) => {
    const length = players.length;
    if (length === 0) return -1;

    let index = startIndex;
    for (let i = 1; i <= length; i += 1) {
        const candidate = players[(index + i) % length];
        if (isActivePlayer(candidate)) {
            return (index + i) % length;
        }
    }

    return -1;
};

export default class BlindManager {
    constructor({ smallBlind = DEFAULT_SMALL_BLIND, bigBlind = DEFAULT_BIG_BLIND, ante = 0 } = {}) {
        if (smallBlind <= 0 || bigBlind <= 0 || bigBlind < smallBlind) {
            throw new Error('BlindManager requires positive blind values and big blind must be >= small blind.');
        }

        this.smallBlind = clampPositiveInteger(smallBlind, DEFAULT_SMALL_BLIND);
        this.bigBlind = clampPositiveInteger(bigBlind, DEFAULT_BIG_BLIND);
        this.ante = clampPositiveInteger(ante, 0);
    }

    getBlindValues() {
        return {
            smallBlind: this.smallBlind,
            bigBlind: this.bigBlind,
            ante: this.ante,
        };
    }

    getActivePlayerIndices(players) {
        return players
            .map((player, index) => ({ player, index }))
            .filter(({ player }) => isActivePlayer(player))
            .map(({ index }) => index);
    }

    getButtonIndex(players, currentButtonIndex = -1) {
        const activeIndices = this.getActivePlayerIndices(players);
        if (activeIndices.length === 0) {
            return -1;
        }

        if (currentButtonIndex >= 0 && isActivePlayer(players[currentButtonIndex])) {
            return currentButtonIndex;
        }

        return activeIndices[0];
    }

    getBlindPositions(players, buttonIndex) {
        const activeIndices = this.getActivePlayerIndices(players);
        if (activeIndices.length === 0 || buttonIndex < 0 || buttonIndex >= players.length) {
            return { buttonIndex: -1, smallBlindIndex: -1, bigBlindIndex: -1 };
        }

        const activeCount = activeIndices.length;
        const nextActive = (index) => getNextIndex(players, index);

        const smallBlindIndex = activeCount === 2 ? buttonIndex : nextActive(buttonIndex);
        const bigBlindIndex = nextActive(smallBlindIndex);

        return {
            buttonIndex,
            smallBlindIndex,
            bigBlindIndex,
        };
    }

    advanceButton(players, currentButtonIndex) {
        const nextButton = getNextIndex(players, currentButtonIndex);
        return nextButton;
    }

    applyBlinds(players, buttonIndex) {
        if (!Array.isArray(players) || players.length === 0) {
            throw new Error('applyBlinds requires an array of player objects.');
        }

        const { buttonIndex: resolvedButton } = this.getBlindPositions(players, buttonIndex);
        if (resolvedButton === -1) {
            throw new Error('Cannot resolve button position when no active players exist.');
        }

        const positions = this.getBlindPositions(players, resolvedButton);
        const updatedPlayers = players.map((player) => ({ ...player }));
        const blinds = {
            smallBlind: 0,
            bigBlind: 0,
            ante: 0,
        };

        const postBlind = (playerIndex, amount) => {
            if (playerIndex < 0) return 0;
            const player = updatedPlayers[playerIndex];
            if (!player || player.folded) return 0;

            const chips = clampPositiveInteger(player.chips, 0);
            const posted = Math.min(chips, amount);
            player.chips = Math.max(0, chips - posted);
            player.currentBet = clampPositiveInteger(player.currentBet, 0) + posted;
            if (player.chips === 0) {
                player.allIn = true;
            }
            return posted;
        };

        blinds.smallBlind = postBlind(positions.smallBlindIndex, this.smallBlind);
        blinds.bigBlind = postBlind(positions.bigBlindIndex, this.bigBlind);

        if (this.ante > 0) {
            blinds.ante = updatedPlayers.reduce((total, player, index) => {
                if (!isActivePlayer(player)) return total;
                const posted = postBlind(index, this.ante);
                return total + posted;
            }, 0);
        }

        const roundBet = Math.max(blinds.smallBlind, blinds.bigBlind, 0);

        return {
            players: updatedPlayers,
            blinds,
            roundBet,
            positions,
        };
    }
}
