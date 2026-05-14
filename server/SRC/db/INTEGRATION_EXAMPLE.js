/**
 * Integration example: how to use HandHistorian in GameStateMachine
 * This shows where to hook in the persistent storage after showdown.
 */

// In your main server file or initialization:
import TursoClient from "./src/db/TursoClient.js";
import HandHistorian from "./src/db/HandHistorian.js";
import GameStateMachine from "./src/engine/GameStateMachine.js";

export async function initializeGame() {
  // 1. Initialize Turso
  const tursoClient = new TursoClient(
    process.env.TURSO_CONNECTION_URL,
    process.env.TURSO_AUTH_TOKEN
  );

  // Verify connection
  const isConnected = await tursoClient.ping();
  if (!isConnected) {
    throw new Error("Failed to connect to Turso database");
  }
  console.log("✓ Turso connected");

  // 2. Initialize historian
  const historian = new HandHistorian(tursoClient);

  // 3. Create game state machine (with all dependencies)
  const game = new GameStateMachine({
    deck,
    blindManager,
    turnTimer,
    actionValidator,
    showdownResolver,
    sidePotCalculator,
  });

  return { game, historian, tursoClient };
}

// In your hand completion flow (inside GameStateMachine._resolveShowdown):
async function endHand(state, historian) {
  // state has: poolId, handNumber, stage, actionHistory
  // After showdown calculation...

  const winners = state.winners; // { playerId → netWinnings }
  const sidePots = state.sidePots; // Array of pot objects

  // Save to Turso
  const handId = await historian.saveHand(
    state.poolId,
    state.handNumber,
    state,
    sidePots,
    winners
  );

  console.log(`✓ Hand ${handId} saved to Turso`);

  return {
    handId,
    winners,
    sidePots,
  };
}

// Query examples:
async function getStats(historian, poolId, playerId) {
  // Player overall stats
  const globalStats = await historian.db.getPlayerStats(playerId);
  console.log("Global stats:", globalStats);

  // Player stats in specific pool
  const poolStats = await historian.getPlayerPoolStats(playerId, poolId);
  console.log("Pool stats:", poolStats);

  // Leaderboard
  const top10 = await historian.db.getLeaderboard(10);
  console.log("Top 10 players:", top10);

  // Audit a hand
  const handAudit = await historian.getHandForAudit(handId);
  console.log("Hand details:", handAudit);
}
