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

    // Restore engine state from Redis after a server restart
    if (this.gameStateMachine.state !== state) {
      this.gameStateMachine.state = state;
    }

    const result = this.gameStateMachine.applyAction(playerId, action);

    if (result.error) {
      return result;
    }

    this.activeGames.set(poolId, result);
    await this.redis.set(`room:${poolId}:game`, JSON.stringify(result), { EX: 86400 });

    if (result.stage === 'showdown') {
      // _resolveShowdown mutates result in-place (sets result.winners, result.sidePots)
      // and re-persists, so the state returned below already contains winner data.
      // Wrapped in try/catch so any unexpected error here never blocks finaliseGame.
      try {
        await this._resolveShowdown(poolId, result);
      } catch (err) {
        console.error(`_resolveShowdown error in pool ${poolId}:`, err.message);
      }
    }

    return result;
  }

  async _resolveShowdown(poolId, state) {
    const sidePots = this.gameStateMachine.sidePotCalculator.calculate(state.players);

    // Aggregate winner amounts: { playerId → totalAmount }
    let winnerAmounts = {};
    const activePlayers = state.players.filter(p => !p.folded);

    if (activePlayers.length === 1) {
      // Fold equity — sole survivor wins the whole pot
      winnerAmounts[activePlayers[0].id] = state.pot;
    } else {
      const results = this.gameStateMachine.showdownResolver.resolve(
        activePlayers,
        state.communityCards,
        sidePots
      );
      results.filter(Boolean).forEach(potResult => {
        potResult.winners.forEach(winnerId => {
          winnerAmounts[winnerId] = (winnerAmounts[winnerId] || 0) + potResult.share;
        });
      });
    }

    // Build winners array in the shape the frontend expects: [{ walletAddress, amount }]
    const winnersArray = Object.entries(winnerAmounts).map(([id, amount]) => {
      const player = state.players.find(p => p.id === id);
      return {
        walletAddress: player?.address ?? player?.walletAddress ?? id,
        amount,
      };
    });

    // Mutate state in-place — applyAction returns this same object, so the
    // socket handler will emit it with winners already set.
    state.winners = winnersArray;
    state.sidePots = sidePots;

    // Persist the enriched state (with winners) to Redis
    this.activeGames.set(poolId, state);
    await this.redis.set(`room:${poolId}:game`, JSON.stringify(state), { EX: 86400 });

    // Hand history (single call — server.js must NOT duplicate this)
    try {
      await this.historian.saveHand(poolId, state.handNumber, state, sidePots, winnerAmounts);
    } catch (err) {
      console.error(`saveHand failed for pool ${poolId}:`, err.message);
    }

    // On-chain payout to the biggest winner
    const topWinner = winnersArray.length > 0
      ? winnersArray.reduce((a, b) => (a.amount >= b.amount ? a : b))
      : null;
    const winnerAddress = topWinner?.walletAddress;

    let payoutInitiated = false;
    if (this.signedContract && winnerAddress) {
      try {
        const tx = await this.signedContract.awardPot(poolId, winnerAddress);
        await tx.wait();
        payoutInitiated = true;
        console.log(`✓ awardPot: pool ${poolId} → ${winnerAddress}`);
      } catch (err) {
        console.error(`awardPot failed for pool ${poolId}:`, err.message);
      }
    } else if (!this.signedContract) {
      console.warn(`awardPot skipped for pool ${poolId} — no admin wallet`);
    }

    // Store payout result so finaliseGame can include it in GAME_ENDED
    state.payoutInitiated = payoutInitiated;

    return { sidePots, winners: winnersArray, payoutInitiated };
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
