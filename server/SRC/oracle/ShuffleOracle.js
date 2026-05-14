/**
 * Generates a server seed and its SHA-256 commitment for provably fair dealing.
 * Commit before the hand; reveal after — players can verify nothing was redrawn.
 *
 * Should:
 * - Generate a fresh random 32-byte seed (hex string)
 * - Compute SHA-256(seed + poolId + nonce) as commitment
 * - Return both seed and commitment for storage
 * - Expose hash function for external verification (e.g., ProofVerifier)
 *
 * Methods:
 * - generateCommitment(poolId, nonce): Returns { seed, commitment }
 * - hash(seed, poolId, nonce): Returns SHA-256 hash of the three inputs
 */

// TODO: Import crypto module
// TODO: Implement generateCommitment(poolId, nonce)
// TODO: Implement _hash(seed, poolId, nonce) using SHA-256
// TODO: Implement public hash(seed, poolId, nonce) method
// TODO: Export as ES module

import crypto from 'crypto';

/**
 * Generates a server seed and its SHA-256 commitment for provably fair dealing.
 * Commit before the hand; reveal after — players can verify nothing was redrawn.
 */
export default class ShuttleOracle {
  /**
   * Generates a fresh random 32-byte seed and its corresponding commitment.
   * 
   * @param {string|number} poolId 
   * @param {string|number} nonce 
   * @returns {Object} { seed, commitment }
   */
  generateCommitment(poolId, nonce) {
    // Generate a fresh random 32-byte seed (hex string)
    const seed = crypto.randomBytes(32).toString('hex');
    
    // Compute the commitment using the public hash method
    const commitment = this.hash(seed, poolId, nonce);

    return {
      seed,
      commitment
    };
  }

  /**
   * Public hash method for external verification (e.g., ProofVerifier).
   * 
   * @param {string} seed 
   * @param {string|number} poolId 
   * @param {string|number} nonce 
   * @returns {string} SHA-256 hash of the three inputs
   */
  hash(seed, poolId, nonce) {
    return this._hash(seed, poolId, nonce);
  }

  /**
   * Internal hash implementation using SHA-256.
   * Computes SHA-256(seed + poolId + nonce)
   * 
   * @private
   * @param {string} seed 
   * @param {string|number} poolId 
   * @param {string|number} nonce 
   * @returns {string}
   */
  _hash(seed, poolId, nonce) {
    // Concatenate inputs: seed + poolId + nonce
    const data = `${seed}${poolId}${nonce}`;
    
    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex');
  }
}