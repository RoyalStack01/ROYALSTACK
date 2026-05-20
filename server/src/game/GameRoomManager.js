/**
 * Game room manager - tracks active games, players, and state
 */

const MAX_ROOMS = 100;

export default class GameRoomManager {
  constructor(redisClient, gameStateMachine, historian, signedContract = null) {
    this.redis = redisClient;
    this.gameStateMachine = gameStateMachine;
    this.historian = historian;
    this.signedContract = signedContract;
    this.activeGames = new Map(); // poolId -> game state
  }

  async createRoom(poolId, players) {
    if (this.activeGames.size >= MAX_ROOMS) {
      throw new Error('Server at capacity');
    }

    if (this.activeGames.has(poolId)) {
      throw new Error(`Room ${poolId} already exists`);
    }

    const seed = await this.redis.get(`oracle:seed:${poolId}`);
    if (!seed) {
      throw new Error(`No seed for pool ${poolId}`);
    }

    const gameState = this.gameStateMachine.startHand(players, seed);
    this.activeGames.set(poolId, gameState);

    await this.redis.set(`room:${poolId}:game`, JSON.stringify(gameState), { EX: 86400 });

    return gameState;
  }

  async getRoom(poolId) {
    if (!this.activeGames.has(poolId)) {
      const raw = await this.redis.get(`room:${poolId}:game`);
      if (raw) {
        const state = JSON.parse(raw);
        this.activeGames.set(poolId, state);
        return state;
      }
      return null;
    }
    return this.activeGames.get(poolId);
  }

  async applyAction(poolId, playerId, action) {
    const state = await this.getRoom(poolId);
    if (!state) throw new Error(`Room ${poolId} not found`);

    const result = this.gameStateMachine.applyAction(playerId, action);

    if (result.error) {
      return result;
    }

    this.activeGames.set(poolId, result);
    await this.redis.set(`room:${poolId}:game`, JSON.stringify(result), { EX: 86400 });

    if (result.stage === 'showdown') {
      await this._resolveShowdown(poolId, result);
    }

    return result;
  }

  async _resolveShowdown(poolId, state) {
    const sidePots = this.gameStateMachine.sidePotCalculator.calculate(
      state.players
    );

    const results = this.gameStateMachine.showdownResolver.resolve(
      state.players,
      state.communityCards,
      sidePots
    );

    const winners = {};
    results.forEach(potResult => {
      potResult.winners.forEach(winnerId => {
        winners[winnerId] = (winners[winnerId] || 0) + potResult.share;
      });
    });

    await this.historian.saveHand(
      poolId,
      state.handNumber,
      state,
      sidePots,
      winners
    );

    // Pay winner on-chain
    const winnerAddress = Object.keys(winners).reduce((a, b) =>
      winners[a] >= winners[b] ? a : b
    );

    if (this.signedContract && winnerAddress) {
      try {
        const tx = await this.signedContract.awardPot(poolId, winnerAddress);
        await tx.wait();
        console.log(`✓ awardPot: pool ${poolId} → ${winnerAddress}`);
      } catch (err) {
        console.error(`awardPot failed for pool ${poolId}:`, err.message);
      }
    } else if (!this.signedContract) {
      console.warn(`awardPot skipped for pool ${poolId} — no admin wallet`);
    }

    return { sidePots, results, winners };
  }

  async closeRoom(poolId) {
    this.activeGames.delete(poolId);
    await this.redis.del(`room:${poolId}:game`);
    await this.redis.del(`room:${poolId}:players`);
  }

  async getActiveRooms() {
    const keys = await this.redis.keys('room:*:state');
    return keys.map(k => k.match(/room:(\d+):state/)[1]);
  }
}
