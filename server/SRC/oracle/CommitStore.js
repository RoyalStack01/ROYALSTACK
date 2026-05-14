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

/**
 * Redis store for seed + commitment hash per hand.
 * Keys expire after 24h to bound memory use.
 */

const TTL_SECONDS = 86400; // 24 hours

export default class CommitStore {
  /**
   * @param {Object} redisClient - An initialized Redis client (e.g., from 'redis' npm package)
   */
  constructor(redisClient) {
    if (!redisClient) {
      throw new Error("Redis client is required for CommitStore");
    }
    this.redis = redisClient;
  }

  /**
   * Internal key formatter
   * @param {string|number} poolId 
   * @param {string|number} nonce 
   * @returns {string}
   */
  _key(poolId, nonce) {
    return `oracle:commit:${poolId}:${nonce}`;
  }

  /**
   * Store and set TTL
   * @param {string|number} poolId 
   * @param {string|number} nonce 
   * @param {Object} data - { seed, commitment }
   */
  async save(poolId, nonce, { seed, commitment }) {
    const key = this._key(poolId, nonce);
    
    // Using hSet to store multiple fields in a Redis hash
    await this.redis.hSet(key, {
      seed: seed,
      commitment: commitment
    });

    // Set expiration so we don't leak memory
    await this.redis.expire(key, TTL_SECONDS);
  }

  /**
   * Get commitment hash only
   * @returns {Promise<string|null>}
   */
  async getCommitment(poolId, nonce) {
    const key = this._key(poolId, nonce);
    return await this.redis.hGet(key, 'commitment');
  }

  /**
   * Get revealed seed
   * @returns {Promise<string|null>}
   */
  async getSeed(poolId, nonce) {
    const key = this._key(poolId, nonce);
    return await this.redis.hGet(key, 'seed');
  }

  /**
   * Get all data for a hand
   * @returns {Promise<Object|null>}
   */
  async getAll(poolId, nonce) {
    const key = this._key(poolId, nonce);
    const data = await this.redis.hGetAll(key);
    
    // Redis hGetAll returns an empty object {} if the key doesn't exist
    if (Object.keys(data).length === 0) {
      return null;
    }
    return data;
  }
}
