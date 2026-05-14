const clampPositiveInteger = (value, fallback = 0) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || Math.floor(number) !== number) {
        return fallback;
    }
    return number;
};

export default class SidePotCalculator {
    static calculatePots(players) {
        if (!Array.isArray(players)) {
            throw new Error('SidePotCalculator requires an array of players.');
        }

        const contributions = players.map((player) => clampPositiveInteger(player?.currentBet, 0));
        const pots = [];

        while (true) {
            const positiveContributions = contributions.filter((amount) => amount > 0);
            if (positiveContributions.length === 0) break;

            const smallest = Math.min(...positiveContributions);
            const eligibleIndices = contributions
                .map((amount, index) => (amount >= smallest ? index : -1))
                .filter((index) => index >= 0);
            const amount = smallest * eligibleIndices.length;

            pots.push({
                amount,
                eligibleIndices,
            });

            for (let index = 0; index < contributions.length; index += 1) {
                if (contributions[index] >= smallest) {
                    contributions[index] -= smallest;
                }
            }
        }

        return pots;
    }

    static getTotalPot(players) {
        return players.reduce((sum, player) => sum + clampPositiveInteger(player?.currentBet, 0), 0);
    }
}
