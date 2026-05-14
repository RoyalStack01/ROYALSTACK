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
