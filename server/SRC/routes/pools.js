/**
 * Pool management routes - join, leave, cancel
 */

const MAX_DEPOSIT = 1000000;

export function createPoolRoutes(app, authService, poolService, cancellationManager) {
  const authMiddleware = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Missing authentication token' });
    }
    const { valid, walletAddress } = await authService.verifySession(token);
    if (!valid || !walletAddress) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    req.sessionToken = token;
    req.user = { walletAddress };
    next();
  };

  const validatePoolId = (req, res, next) => {
    const id = parseInt(req.params.poolId, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid pool ID' });
    }
    next();
  };

  // List all pools
  app.get('/api/pools', authMiddleware, async (req, res) => {
    try {
      const poolIds = await poolService.getAllPools();
      const pools = await Promise.all(
        poolIds.map(async (id) => {
          const state = await poolService.getPoolState(id);
          const playerCount = await poolService.getPoolPlayers(id).then(p => p.length);
          const cancellationInfo = await cancellationManager.getPoolCancellationInfo(id);
          return { ...state, playerCount, cancellationInfo };
        })
      );
      res.json(pools);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get pool details
  app.get('/api/pools/:poolId', authMiddleware, validatePoolId, async (req, res) => {
    try {
      const { poolId } = req.params;
      const state = await poolService.getPoolState(poolId);
      const players = await poolService.getPoolPlayers(poolId);
      const cancellationInfo = await cancellationManager.getPoolCancellationInfo(poolId);

      res.json({
        ...state,
        players,
        playerCount: players.length,
        cancellationInfo,
        isFull: players.length === 5,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Join pool
  app.post('/api/pools/:poolId/join', authMiddleware, validatePoolId, async (req, res) => {
    try {
      const { poolId } = req.params;
      const { amount } = req.body;
      // walletAddress comes from auth header via middleware
      const walletAddress = req.user?.walletAddress;

      if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_DEPOSIT) {
        return res.status(400).json({ error: 'Invalid deposit amount' });
      }

      const poolState = await poolService.getPoolState(poolId);
      if (!poolState) {
        return res.status(404).json({ error: 'Pool not found' });
      }

      if (poolState.status !== 'ACTIVE') {
        return res.status(400).json({ error: 'Pool is not active' });
      }

      if (poolState.playerCount >= 5) {
        return res.status(400).json({ error: 'Pool is full' });
      }

      // Add player to pool
      const playerCount = await poolService.addPlayerToPool(
        poolId,
        walletAddress,
        amount
      );

      console.log(`✓ Player joined pool ${poolId} (${playerCount}/5)`);

      // Check if pool is now ready
      const readiness = await cancellationManager.checkPoolReadiness(poolId);

      res.json({
        message: 'Joined pool',
        poolId,
        playerCount,
        isFull: readiness.ready,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Request to leave pool (before game starts)
  // If creator leaves, pool is auto-cancelled
  app.post('/api/pools/:poolId/leave', authMiddleware, validatePoolId, async (req, res) => {
    try {
      const { poolId } = req.params;
      const walletAddress = req.user?.walletAddress;

      const poolState = await poolService.getPoolState(poolId);
      if (!poolState) {
        return res.status(404).json({ error: 'Pool not found' });
      }

      // Check if player is the creator
      const isCreator = poolState.creator === walletAddress;

      const result = await cancellationManager.removePlayerFromPool(
        poolId,
        walletAddress
      );

      if (!result.valid && result.success !== true) {
        return res.status(400).json(result);
      }

      // If creator left and pool was cancelled — cancelPool auto-refunds all depositors
      if (isCreator && result.success === true) {
        return res.json({
          message: 'Pool cancelled — all depositors have been automatically refunded on-chain',
          poolId,
          action: 'cancelled',
          ...result,
        });
      }

      res.json({
        message: 'Left pool',
        poolId,
        ...result,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Request pool cancellation (creator only)
  app.post('/api/pools/:poolId/cancel', authMiddleware, validatePoolId, async (req, res) => {
    try {
      const { poolId } = req.params;
      const walletAddress = req.user?.walletAddress;

      const validation = await cancellationManager.requestCancelPool(
        poolId,
        walletAddress
      );

      if (!validation.valid) {
        return res.status(400).json(validation);
      }

      const result = await cancellationManager.cancelPool(
        poolId,
        'creator_requested',
        `Cancelled by creator ${walletAddress ? walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4) : 'unknown'}`
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get cancellation info
  app.get('/api/pools/:poolId/cancellation-info', authMiddleware, validatePoolId, async (req, res) => {
    try {
      const { poolId } = req.params;
      const info = await cancellationManager.getPoolCancellationInfo(poolId);

      if (!info) {
        return res.json({ cancelled: false });
      }

      res.json({
        cancelled: true,
        ...info,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}
