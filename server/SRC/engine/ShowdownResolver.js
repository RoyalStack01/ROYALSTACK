import HandEvaluator from './HandEvaluator.js';
import SidePotCalculator from './SidePotCalculator.js';

export default class ShowdownResolver {
    static buildPlayerHands(players, board) {
        return players.map((player) => {
            if (!player?.holeCards || player?.folded) {
                return null;
            }
            const combined = [...player.holeCards, ...board];
            const evaluation = HandEvaluator.evaluate(combined);
            return {
                playerId: player.id,
                hand: evaluation,
                holeCards: player.holeCards,
            };
        });
    }

    static determinePotWinners(players, board) {
        const playerHands = ShowdownResolver.buildPlayerHands(players, board);
        const pots = SidePotCalculator.calculatePots(players);
        const payouts = [];

        for (const pot of pots) {
            const eligible = pot.eligibleIndices
                .filter((index) => !players[index]?.folded)
                .map((index) => ({
                    index,
                    player: players[index],
                    hand: playerHands[index],
                }))
                .filter((entry) => entry.hand !== null);

            if (eligible.length === 0) {
                payouts.push({ pot, winners: [], amountPerWinner: 0 });
                continue;
            }

            const bestScore = Math.max(...eligible.map((entry) => entry.hand.score));
            const winners = eligible.filter((entry) => entry.hand.score === bestScore);
            const amountPerWinner = Math.floor(pot.amount / winners.length);

            payouts.push({
                pot,
                winners: winners.map((entry) => ({ playerId: entry.player.id, index: entry.index })),
                amountPerWinner,
            });
        }

        return {
            pots,
            payouts,
            playerHands,
        };
    }
}
