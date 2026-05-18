/**
 * Verifies that the revealed seed matches the stored commitment.
 * Anyone can run this client-side to confirm the shuffle was not changed mid-hand.
 *
 * Should:
 * - Load stored commitment from CommitStore
 * - Recompute hash: SHA-256(revealedSeed + poolId + nonce)
 * - Compare computed hash against stored commitment
 * - Return true if match, false if mismatch or not found
 * - Expose full proof (seed + commitment) for client-side verification
 *
 * Methods:
 * - constructor(commitStore)
 * - verify(poolId, nonce, revealedSeed): Returns boolean promise
 * - getProof(poolId, nonce): Returns { seed, commitment } promise
 *
 * Usage:
 * const isValid = await verifier.verify(poolId, 1, revealedSeed);
 */

// TODO: Import CommitStore and ShuffleOracle, export as ES module
// TODO: Implement constructor(commitStore)
// TODO: Implement verify(poolId, nonce, revealedSeed)
// TODO: Implement hash comparison logic
// TODO: Implement getProof(poolId, nonce)
// TODO: Use ShuffleOracle.hash() for verification

import CommitStore from './CommitStore.js';
import ShuffleOracle from './ShuffleOracle.js';

/**
 * Verifies that the revealed seed matches the stored commitment.
 * Anyone can run this client-side to confirm the shuffle was not changed mid-hand.
 */
export default class ProofVerifier {
  /**
   * @param {CommitStore} commitStore - Instance of the Redis-backed store
   */
  constructor(commitStore) {
    if (!commitStore) {
      throw new Error("CommitStore instance is required for ProofVerifier");
    }
    this.commitStore = commitStore;
  }

  /**
   * Recomputes the hash using the ShuttleOracle logic and compares it
   * against the commitment stored in Redis.
   * 
   * @param {string|number} poolId 
   * @param {string|number} nonce 
   * @param {string} revealedSeed 
   * @returns {Promise<boolean>} True if match, false if mismatch or not found
   */
  async verify(poolId, nonce, revealedSeed) {
    const storedData = await this.commitStore.getAll(poolId, nonce);

    // If no data exists (expired or never created), verification cannot pass
    if (!storedData || !storedData.commitment) {
      return false;
    }

    // Recompute hash: SHA-256(revealedSeed + poolId + nonce)
    // Using the static method from ShuffleOracle ensures consistent hashing logic
    const computedHash = ShuffleOracle.hash(revealedSeed, poolId, nonce);

    // Constant-time comparison is ideal, but for a standard verification 
    // string comparison works here.
    return computedHash === storedData.commitment;
  }

  /**
   * Exposes full proof (seed + commitment) for client-side verification.
   * 
   * @param {string|number} poolId 
   * @param {string|number} nonce 
   * @returns {Promise<Object|null>} { seed, commitment } or null if not found
   */
  async getProof(poolId, nonce) {
    const data = await this.commitStore.getAll(poolId, nonce);

    if (!data) {
      return null;
    }

    return {
      seed: data.seed,
      commitment: data.commitment
    };
  }
}
