const CATEGORY = {
    HIGH_CARD: 1,
    PAIR: 2,
    TWO_PAIR: 3,
    THREE_OF_A_KIND: 4,
    STRAIGHT: 5,
    FLUSH: 6,
    FULL_HOUSE: 7,
    FOUR_OF_A_KIND: 8,
    STRAIGHT_FLUSH: 9,
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const sortDesc = (values) => [...values].sort((a, b) => b - a);

const uniqueDesc = (values) => {
    const seen = new Set();
    return values.filter((value) => {
        if (seen.has(value)) return false;
        seen.add(value);
        return true;
    });
};

const buildScore = (category, ranks) => {
    const base = category * 15 ** 5;
    const kicker = ranks.reduce((sum, rank, index) => sum + rank * 15 ** (4 - index), 0);
    return base + kicker;
};

const groupBy = (items, keyFn) => items.reduce((map, item) => {
    const key = keyFn(item);
    const group = map.get(key) ?? [];
    group.push(item);
    map.set(key, group);
    return map;
}, new Map());

const findStraight = (ranks) => {
    const unique = uniqueDesc(sortDesc(ranks));
    if (unique[0] === 14) {
        unique.push(1);
    }

    for (let i = 0; i <= unique.length - 5; i += 1) {
        const window = unique.slice(i, i + 5);
        const expected = Array.from({ length: 5 }, (_, index) => window[0] - index);
        if (window.every((rank, index) => rank === expected[index])) {
            return window[0];
        }
    }

    return null;
};

const findFlush = (cards) => {
    const suitGroups = groupBy(cards, (card) => card.suit);
    for (const [suit, group] of suitGroups) {
        if (group.length >= 5) {
            const sorted = sortDesc(group.map((card) => card.rank));
            return { suit, ranks: sorted.slice(0, 5), cards: group };
        }
    }
    return null;
};

const findStraightFlush = (cards) => {
    const suitGroups = groupBy(cards, (card) => card.suit);
    for (const group of suitGroups.values()) {
        if (group.length < 5) continue;
        const ranks = group.map((card) => card.rank);
        const topRank = findStraight(ranks);
        if (topRank) {
            return { topRank, suit: group[0].suit };
        }
    }
    return null;
};

const evaluateFive = (cards) => {
    const sortedRanks = sortDesc(cards.map((card) => card.rank));
    const rankGroups = [...groupBy(cards, (card) => card.rank).entries()]
        .map(([rank, group]) => ({ rank: Number(rank), count: group.length, cards: group }))
        .sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            return b.rank - a.rank;
        });

    const counts = rankGroups.map((group) => group.count);
    const rankOrder = rankGroups.flatMap((group) => Array(group.count).fill(group.rank));
    const flush = findFlush(cards);
    const straightTop = findStraight(sortedRanks);
    const straightFlush = findStraightFlush(cards);

    if (straightFlush) {
        return {
            category: CATEGORY.STRAIGHT_FLUSH,
            score: buildScore(CATEGORY.STRAIGHT_FLUSH, [straightFlush.topRank]),
            ranks: [straightFlush.topRank],
            cards,
        };
    }

    if (counts[0] === 4) {
        const kicker = sortedRanks.filter((rank) => rank !== rankGroups[0].rank)[0];
        return {
            category: CATEGORY.FOUR_OF_A_KIND,
            score: buildScore(CATEGORY.FOUR_OF_A_KIND, [rankGroups[0].rank, kicker]),
            ranks: [rankGroups[0].rank, kicker],
            cards,
        };
    }

    if (counts[0] === 3 && counts[1] >= 2) {
        return {
            category: CATEGORY.FULL_HOUSE,
            score: buildScore(CATEGORY.FULL_HOUSE, [rankGroups[0].rank, rankGroups[1].rank]),
            ranks: [rankGroups[0].rank, rankGroups[1].rank],
            cards,
        };
    }

    if (flush) {
        return {
            category: CATEGORY.FLUSH,
            score: buildScore(CATEGORY.FLUSH, flush.ranks.slice(0, 5)),
            ranks: flush.ranks.slice(0, 5),
            cards,
        };
    }

    if (straightTop) {
        return {
            category: CATEGORY.STRAIGHT,
            score: buildScore(CATEGORY.STRAIGHT, [straightTop]),
            ranks: [straightTop],
            cards,
        };
    }

    if (counts[0] === 3) {
        const kickers = sortedRanks.filter((rank) => rank !== rankGroups[0].rank).slice(0, 2);
        return {
            category: CATEGORY.THREE_OF_A_KIND,
            score: buildScore(CATEGORY.THREE_OF_A_KIND, [rankGroups[0].rank, ...kickers]),
            ranks: [rankGroups[0].rank, ...kickers],
            cards,
        };
    }

    if (counts[0] === 2 && counts[1] === 2) {
        const pairRanks = [rankGroups[0].rank, rankGroups[1].rank];
        const kicker = sortedRanks.filter((rank) => !pairRanks.includes(rank))[0];
        return {
            category: CATEGORY.TWO_PAIR,
            score: buildScore(CATEGORY.TWO_PAIR, [pairRanks[0], pairRanks[1], kicker]),
            ranks: [pairRanks[0], pairRanks[1], kicker],
            cards,
        };
    }

    if (counts[0] === 2) {
        const kickers = sortedRanks.filter((rank) => rank !== rankGroups[0].rank).slice(0, 3);
        return {
            category: CATEGORY.PAIR,
            score: buildScore(CATEGORY.PAIR, [rankGroups[0].rank, ...kickers]),
            ranks: [rankGroups[0].rank, ...kickers],
            cards,
        };
    }

    return {
        category: CATEGORY.HIGH_CARD,
        score: buildScore(CATEGORY.HIGH_CARD, sortedRanks.slice(0, 5)),
        ranks: sortedRanks.slice(0, 5),
        cards,
    };
};

const combinations = (cards, size) => {
    const result = [];
    const build = (start, combo) => {
        if (combo.length === size) {
            result.push(combo);
            return;
        }
        for (let i = start; i < cards.length; i += 1) {
            build(i + 1, [...combo, cards[i]]);
        }
    };
    build(0, []);
    return result;
};

export default class HandEvaluator {
    static CATEGORY = CATEGORY;

    static evaluate(cards) {
        if (!Array.isArray(cards) || cards.length < 5) {
            throw new Error('HandEvaluator requires at least five cards.');
        }
        const best = cards.length === 5
            ? evaluateFive(cards)
            : combinations(cards, 5).reduce((bestHand, combo) => {
                const candidate = evaluateFive(combo);
                return candidate.score > bestHand.score ? candidate : bestHand;
            }, { score: 0 });
        return clone(best);
    }

    static compare(handA, handB) {
        if (handA.score > handB.score) return 1;
        if (handA.score < handB.score) return -1;
        return 0;
    }
}
