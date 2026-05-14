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
