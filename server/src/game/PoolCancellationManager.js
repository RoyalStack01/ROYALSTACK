/**
 * Pool timeout and cancellation logic
 */

export default class PoolCancellationManager {
  constructor(redisClient, signedContract, poolService) {
    this.redis = redisClient;
    this.signedContract = signedContract;
    this.poolService = poolService;
    this.timeouts = new Map(); // poolId -> timeout handle
    this.POOL_FILL_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes to fill pool
  }

  /**
   * Start timeout when pool is created
   * If not filled within time, auto-cancel
   */
  async startPoolTimeout(poolId) {
    // Clear existing timeout if any
    if (this.timeouts.has(poolId)) {
      clearTimeout(this.timeouts.get(poolId));
    }

    const timeoutHandle = setTimeout(async () => {
      try {
        const poolState = await this.poolService.getPoolState(poolId);

        // Auto-cancel if still not full
        if (poolState && poolState.playerCount < 5 && poolState.status === 'ACTIVE') {
          console.log(`⏱️ Pool ${poolId} timeout: auto-cancelling (${poolState.playerCount}/5 players)`);
          await this.cancelPool(poolId, 'auto', 'Pool fill timeout');
        }
      } catch (error) {
        console.error(`Error checking pool timeout for ${poolId}:`, error);
      }

      this.timeouts.delete(poolId);
    }, this.POOL_FILL_TIMEOUT_MS);

    this.timeouts.set(poolId, timeoutHandle);
  }

  /**
   * Clear timeout if pool fills to 5 players
   */
  clearPoolTimeout(poolId) {
    if (this.timeouts.has(poolId)) {
      clearTimeout(this.timeouts.get(poolId));
      this.timeouts.delete(poolId);
    }
  }

  /**
   * Player requests to leave pool
   * Only valid if game hasn't started
   */
  async requestLeavePool(poolId, playerAddress) {
    const poolState = await this.poolService.getPoolState(poolId);

    if (!poolState) {
      return { valid: false, reason: 'Pool not found' };
    }

    if (poolState.status !== 'ACTIVE') {
      return { valid: false, reason: 'Pool is not active' };
    }

    const player = await this.poolService.getPlayerInPool(poolId, playerAddress);
    if (!player) {
      return { valid: false, reason: 'Player not in pool' };
    }

    // Check if game has started (more than 1 player and already betting)
    const room = await this.redis.hGetAll(`room:${poolId}:state`);
    if (room && Object.keys(room).length > 0) {
      const state = JSON.parse(Object.values(room)[0]);
      if (state.stage !== 'preflop' || state.pot > 0) {
        return { valid: false, reason: 'Game has already started' };
      }
    }

    return { valid: true };
  }

  /**
   * Creator requests pool cancellation
   * Only creator can cancel, and only if game hasn't started
   */
  async requestCancelPool(poolId, requesterAddress) {
    const poolState = await this.poolService.getPoolState(poolId);

    if (!poolState) {
      return { valid: false, reason: 'Pool not found' };
    }

    if (poolState.status !== 'ACTIVE') {
      return { valid: false, reason: 'Pool is not active' };
    }

    // Only creator can cancel
    if (poolState.creator !== requesterAddress) {
      return { valid: false, reason: 'Only pool creator can cancel' };
    }

    // Can't cancel if game is active
    const room = await this.redis.hGetAll(`room:${poolId}:state`);
    if (room && Object.keys(room).length > 0) {
      const state = JSON.parse(Object.values(room)[0]);
      if (state.stage !== 'preflop' || state.pot > 0) {
        return { valid: false, reason: 'Cannot cancel pool while game is active' };
      }
    }

    return { valid: true };
  }

  /**
   * Cancel pool and refund all players
   * Cannot cancel if game is active (pot > 0 or past preflop)
   */
  async cancelPool(poolId, reason = 'requested', details = '') {
    try {
      console.log(`🛑 Cancelling pool ${poolId}: ${reason} - ${details}`);

      const poolState = await this.poolService.getPoolState(poolId);
      if (!poolState) {
        throw new Error('Pool not found');
      }

      if (poolState.status !== 'ACTIVE') {
        throw new Error('Pool is not active');
      }

      // Check if game has started - cannot cancel if it has
      const room = await this.redis.hGetAll(`room:${poolId}:state`);
      if (room && Object.keys(room).length > 0) {
        const state = JSON.parse(Object.values(room)[0]);
        if (state.stage !== 'preflop' || state.pot > 0) {
          throw new Error('Cannot cancel pool while game is active');
        }
      }

      // Mark as closed in Redis
      const closedState = { ...poolState, status: 'CLOSED' };
      await this.redis.set(`pool:${poolId}`, JSON.stringify(closedState));

      // Store cancellation reason
      await this.redis.hSet(`pool:${poolId}:cancelled`, 'reason', reason);
      await this.redis.hSet(`pool:${poolId}:cancelled`, 'details', details);
      await this.redis.hSet(
        `pool:${poolId}:cancelled`,
        'timestamp',
        Date.now().toString()
      );

      // Get all players for refund records
      const players = await this.poolService.getPoolPlayers(poolId);

      // Call contract — cancelPool auto-refunds all depositors in the same tx
      if (this.signedContract) {
        try {
          const tx = await this.signedContract.cancelPool(poolId);
          await tx.wait();
          console.log(`✓ Pool ${poolId} cancelled on-chain`);
        } catch (error) {
          console.error(`Warning: Failed to cancel pool on-chain: ${error.message}`);
        }
      } else {
        console.warn(`cancelPool skipped for pool ${poolId} — no admin wallet`);
      }

      // Clear timeout
      this.clearPoolTimeout(poolId);

      return {
        success: true,
        poolId,
        reason,
        playersRefunded: players.length,
      };
    } catch (error) {
      console.error(`Error cancelling pool ${poolId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove single player from pool (before game starts)
   * If creator leaves, auto-cancel the pool
   */
  async removePlayerFromPool(poolId, playerAddress) {
    try {
      const validation = await this.requestLeavePool(poolId, playerAddress);
      if (!validation.valid) {
        return validation;
      }

      const poolState = await this.poolService.getPoolState(poolId);

      // If the creator is leaving, auto-cancel the pool
      if (poolState.creator === playerAddress) {
        console.log(
          `👑 Pool creator ${playerAddress} left pool ${poolId}. Auto-cancelling...`
        );
        return await this.cancelPool(
          poolId,
          'creator_left',
          `Creator ${playerAddress} left the pool`
        );
      }

      // Otherwise just remove the player
      await this.redis.hDel(`room:${poolId}:players`, playerAddress);

      const remainingPlayers = await this.poolService.getPoolPlayers(poolId);

      console.log(
        `👤 Player ${playerAddress} left pool ${poolId} (${remainingPlayers.length}/5 remaining)`
      );

      return {
        valid: true,
        message: 'Player removed from pool',
        playersRemaining: remainingPlayers.length,
      };
    } catch (error) {
      return { valid: false, reason: error.message };
    }
  }

  /**
   * Check and handle pool readiness
   * Move from "waitlist" to "active game" when 5 players join
   */
  async checkPoolReadiness(poolId) {
    const players = await this.poolService.getPoolPlayers(poolId);

    if (players.length === 5) {
      this.clearPoolTimeout(poolId);
      console.log(`🎮 Pool ${poolId} is ready! Starting game...`);
      return { ready: true, playerCount: 5 };
    }

    return { ready: false, playerCount: players.length };
  }

  /**
   * Get pool cancellation info
   */
  async getPoolCancellationInfo(poolId) {
    const data = await this.redis.hGetAll(`pool:${poolId}:cancelled`);

    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    return {
      reason: data.reason,
      details: data.details,
      timestamp: parseInt(data.timestamp),
    };
  }
}
