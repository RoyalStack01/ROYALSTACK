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
