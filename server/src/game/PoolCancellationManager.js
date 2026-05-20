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
  async startPoolTimeout(poolId, delayMs = this.POOL_FILL_TIMEOUT_MS) {
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
    }, delayMs);

    this.timeouts.set(poolId, timeoutHandle);
  }

  /**
   * On server restart, re-arm timeouts for all active pools that haven't expired yet.
   * Called once during server initialization after all components are wired up.
   */
  async restoreTimeouts() {
    try {
      const poolIds = await this.poolService.getAllPools();
      let restored = 0;

      for (const id of poolIds) {
        const state = await this.poolService.getPoolState(id);
        if (!state || state.status !== 'ACTIVE') continue;

        // gameStarted lives in room:N:state, not in the pool cache
        const roomRaw = await this.redis.hGet(`room:${id}:state`, 'data');
        if (roomRaw) {
          const roomState = JSON.parse(roomRaw);
          if (roomState.gameStarted) continue;
        }

        const createdAt = state.createdAt || 0;
        const elapsed = Date.now() - createdAt;
        const remaining = this.POOL_FILL_TIMEOUT_MS - elapsed;

        if (remaining <= 0) {
          // Already expired — cancel immediately
          console.log(`⏱️ Pool ${id} expired during downtime, cancelling...`);
          await this.cancelPool(id, 'auto', 'Pool fill timeout (expired during restart)');
        } else {
          // Re-arm with remaining time
          await this.startPoolTimeout(id, remaining);
          restored++;
          console.log(`⏱️ Pool ${id} timeout restored (${Math.round(remaining / 1000)}s remaining)`);
        }
      }

      if (restored > 0 || poolIds.length > 0) {
        console.log(`✓ Cancellation timeouts restored (${restored} active pools)`);
      }
    } catch (err) {
      console.error('Failed to restore pool timeouts:', err.message);
    }
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

    // Check if game has started
    const roomRaw = await this.redis.hGet(`room:${poolId}:state`, 'data');
    if (roomRaw) {
      const roomState = JSON.parse(roomRaw);
      if (roomState.gameStarted) {
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
    const roomRaw = await this.redis.hGet(`room:${poolId}:state`, 'data');
    if (roomRaw) {
      const roomState = JSON.parse(roomRaw);
      if (roomState.gameStarted) {
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
      const roomRaw = await this.redis.hGet(`room:${poolId}:state`, 'data');
      if (roomRaw) {
        const roomState = JSON.parse(roomRaw);
        if (roomState.gameStarted) {
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

      // Notify connected clients
      if (this.io) {
        this.io.to(`pool:${poolId}`).emit('POOL_CANCELLED', { poolId: poolId.toString(), reason });
      }

      // Remove all pool keys so they don't keep appearing in lobby scans
      await this.poolService.deletePoolKeys(poolId);
      this.poolService.invalidatePoolsCache();

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
    const activeCount = players.filter(p => p.status === 'active').length;

    if (activeCount === 5) {
      this.clearPoolTimeout(poolId);
      return { ready: true, playerCount: activeCount };
    }

    return { ready: false, playerCount: activeCount };
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
