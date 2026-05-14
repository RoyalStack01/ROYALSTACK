import { randomInt } from 'crypto';

const SUITS = ['S', 'H', 'D', 'C'];
const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
const RANK_LABELS = {
    11: 'J',
    12: 'Q',
    13: 'K',
    14: 'A',
};

const createCard = (rank, suit) => ({
    rank,
    suit,
    code: `${rank}${suit}`,
    label: `${RANK_LABELS[rank] ?? rank}${suit}`,
});

const buildDeck = () => SUITS.flatMap((suit) => RANKS.map((rank) => createCard(rank, suit)));

export default class Deck {
    constructor(cards = buildDeck()) {
        this.cards = [...cards];
        this.discardPile = [];
    }

    reset() {
        this.cards = buildDeck();
        this.discardPile = [];
        return this;
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i -= 1) {
            const j = randomInt(0, i + 1);
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
        return this;
    }

    draw(count = 1) {
        if (count === 1) {
            return this.cards.shift() ?? null;
        }

        const drawn = [];
        for (let i = 0; i < count; i += 1) {
            const card = this.cards.shift();
            if (!card) break;
            drawn.push(card);
        }
        return drawn;
    }

    burn(count = 1) {
        const burned = this.draw(count);
        if (Array.isArray(burned)) {
            this.discardPile.push(...burned);
        } else if (burned) {
            this.discardPile.push(burned);
        }
        return this;
    }

    deal(count = 1) {
        return this.draw(count);
    }

    remaining() {
        return this.cards.length;
    }
}
