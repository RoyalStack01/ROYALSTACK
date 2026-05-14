/**
 * Admin routes for pool management
 * Requires ADMIN_ADDRESS in Authorization header
 */

const maskWallet = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : 'unknown';

export function createAdminRoutes(app, authService, poolService, gameRoomManager, tursoClient) {
  const adminMiddleware = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    const { valid, walletAddress } = await authService.verifySession(token);

    if (!valid || walletAddress?.toLowerCase() !== process.env.ADMIN_ADDRESS?.toLowerCase()) {
      console.warn(`Admin access denied for ${maskWallet(walletAddress)}`);
      return res.status(403).json({ error: 'Admin access denied' });
    }

    next();
  };

  // Cancel pool - refund all players
  app.post('/admin/cancel-pool/:poolId', adminMiddleware, async (req, res) => {
    try {
      const { poolId } = req.params;

      const poolState = await poolService.getPoolState(poolId);
      if (!poolState) {
        return res.status(404).json({ error: 'Pool not found' });
      }

      if (poolState.status !== 'ACTIVE') {
        return res.status(400).json({ error: 'Pool not active' });
      }

      await gameRoomManager.closeRoom(poolId);
      await poolService.syncPoolFromChain(poolId);

      res.json({
        message: 'Pool cancelled',
        poolId,
        participants: poolState.participants,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Force end current hand
  app.post('/admin/force-end-hand/:poolId', adminMiddleware, async (req, res) => {
    try {
      const { poolId } = req.params;

      const room = await gameRoomManager.getRoom(poolId);
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      if (room.stage === 'showdown') {
        return res.status(400).json({ error: 'Hand already over' });
      }

      const result = await gameRoomManager._resolveShowdown(poolId, room);

      res.json({
        message: 'Hand forced to end',
        poolId,
        winners: result.winners,
        payouts: result.results,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get all active rooms
  app.get('/admin/rooms', adminMiddleware, async (req, res) => {
    try {
      const rooms = await gameRoomManager.getActiveRooms();
      const details = await Promise.all(
        rooms.map(async (roomId) => {
          const state = await gameRoomManager.getRoom(roomId);
          const players = await poolService.getPoolPlayers(roomId);
          return { roomId, state, players };
        })
      );

      res.json(details);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get all pools
  app.get('/admin/pools', adminMiddleware, async (req, res) => {
    try {
      const poolIds = await poolService.getAllPools();
      const pools = await Promise.all(
        poolIds.map(id => poolService.getPoolState(id))
      );

      res.json(pools);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get database stats
  app.get('/admin/stats', adminMiddleware, async (req, res) => {
    try {
      const totalHands = await tursoClient.client.execute(
        'SELECT COUNT(*) as count FROM hands'
      );
      const totalPlayers = await tursoClient.client.execute(
        'SELECT COUNT(*) as count FROM player_stats'
      );
      const totalWinnings = await tursoClient.client.execute(
        'SELECT SUM(totalWinnings) as sum FROM player_stats'
      );

      res.json({
        totalHands: totalHands.rows[0]?.count || 0,
        totalPlayers: totalPlayers.rows[0]?.count || 0,
        totalWinnings: totalWinnings.rows[0]?.sum || 0,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}
