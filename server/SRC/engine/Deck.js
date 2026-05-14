/**
 * 52-card deck with Fisher-Yates seeded shuffle.
 * Deterministic shuffle for provably fair dealing.
 *
 * Should:
 * - Store all 52 standard cards as strings (e.g. 'As', 'Kh', '2d', etc.)
 * - Implement Fisher-Yates shuffle using seeded PRNG (not cryptographic, but deterministic)
 * - Shuffle from a string seed (e.g., hex SHA-256 hash from ShuffleOracle)
 * - Deal cards sequentially from shuffled deck
 * - Track current position to prevent overdrawing
 *
 * Methods:
 * - shuffle(seed): Fisher-Yates shuffle using seed-derived PRNG
 * - deal(n): Return n cards from top of deck, advance position
 * - get remaining(): Return cards left in deck
 * - _seededRng(seed): Mulberry32 PRNG seeded from string
 * - _hashSeed(str): Simple hash function to convert string to seed value
 *
 * Card format: rank (2-9, T, J, Q, K, A) + suit (s, h, d, c)
 */

// TODO: Import/export as ES module
// TODO: Define RANKS and SUITS constants
// TODO: Implement constructor()
// TODO: Implement shuffle(seed) with Fisher-Yates
// TODO: Implement deal(n)
// TODO: Implement remaining getter
// TODO: Implement _seededRng(seed) using Mulberry32
// TODO: Implement _hashSeed(str) for string-to-number conversion


/**
 * Deck.js
 * 52-card deck with Fisher-Yates seeded shuffle.
 */

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SUITS = ['s', 'h', 'd', 'c'];

export class Deck {
  constructor() {
    this.cards = [];
    this.currentIndex = 0;
    this._generateDeck();
  }

  /**
   * Generates a standard 52-card deck.
   * @private
   */
  _generateDeck() {
    this.cards = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        this.cards.push(`${rank}${suit}`);
      }
    }
  }

  /**
   * Shuffles the deck using Fisher-Yates algorithm and a seeded PRNG.
   * @param {string} seed - A string seed (e.g., a SHA-256 hash).
   */
  shuffle(seed) {
    if (!seed) throw new Error("Seed is required for deterministic shuffle.");
    
    // Reset deck and position
    this._generateDeck();
    this.currentIndex = 0;

    let seedValue = this._hashSeed(seed);
    const rng = this._seededRng(seedValue);

    // Fisher-Yates Shuffle
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  /**
   * Deals n cards from the top of the deck.
   * @param {number} n - Number of cards to deal.
   * @returns {Array<string>} Array of card strings.
   */
  deal(n) {
    if (this.currentIndex + n > this.cards.length) {
      throw new Error("Not enough cards remaining in the deck.");
    }

    const dealtCards = this.cards.slice(this.currentIndex, this.currentIndex + n);
    this.currentIndex += n;
    return dealtCards;
  }

  /**
   * Returns number of cards left in the deck.
   */
  get remaining() {
    return this.cards.length - this.currentIndex;
  }

  /**
   * Mulberry32 PRNG.
   * A fast, high-quality PRNG for 32-bit seeds.
   * @private
   */
  _seededRng(a) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /**
   * Converts a string seed into a 32-bit integer.
   * @private
   */
  _hashSeed(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  }
}