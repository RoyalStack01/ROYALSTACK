/**
 * Redis store for seed + commitment hash per hand.
 * Keys expire after 24h to bound memory use.
 *
 * Should:
 * - Use Redis hash to store { seed, commitment } for each hand
 * - Key format: oracle:commit:{poolId}:{nonce}
 * - Set TTL of 86400 seconds (24 hours) on each key
 * - Provide methods to save, retrieve seed/commitment, and get all data
 *
 * Methods:
 * - constructor(redisClient)
 * - save(poolId, nonce, { seed, commitment }): Store and set TTL
 * - getCommitment(poolId, nonce): Get commitment hash only
 * - getSeed(poolId, nonce): Get revealed seed
 * - getAll(poolId, nonce): Get all data for a hand
 * - _key(poolId, nonce): Internal key formatter
 *
 * Usage:
 * await store.save(poolId, 1, { seed: '0x...', commitment: 'sha256...' });
 */

// TODO: Import/export as ES module
// TODO: Implement constructor(redisClient)
// TODO: Implement save(poolId, nonce, { seed, commitment })
// TODO: Implement getCommitment(poolId, nonce)
// TODO: Implement getSeed(poolId, nonce)
// TODO: Implement getAll(poolId, nonce)
// TODO: Implement _key(poolId, nonce)
// TODO: Set TTL_SECONDS = 86400
