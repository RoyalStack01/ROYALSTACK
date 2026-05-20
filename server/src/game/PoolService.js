/**
 * Pool service - manages pool state and player registration
 */

/** Sanitize poolId before using it in Redis keys to prevent key injection. */
const safeId = (id) => String(id).replace(/[^a-zA-Z0-9_-]/g, '');

function parseOnChain(onChain, roomCreator) {
  return {
    id: onChain.id.toString(),
    creator: roomCreator ?? onChain.creator,
    status: onChain.poolStatus === 0 ? 'ACTIVE' : 'CLOSED',
    playerCount: Number(onChain.participantCount),
    totalDeposited: onChain.totalDeposited.toString(),
  };
}

export default class PoolService {
  constructor(redisClient, contract) {
    this.redis = redisClient;
    this.contract = contract;
    this._allPoolsCache = null;   // { ids: string[], at: number }
    this._ALL_POOLS_TTL = 10_000; // 10 s
  }

  async getPoolState(poolId) {
    const sid = safeId(poolId);

    // Room creator is stored separately — contract creator is the admin wallet, not the user
    const meta = await this.redis.hGetAll(`room:${sid}:meta`);
    const roomCreator = meta?.creator || null;

    // Check EventListener's namespace first (room:N:state), then pool:N cache
    const roomState = await this.redis.hGet(`room:${sid}:state`, 'data');
    if (roomState) {
      const state = JSON.parse(roomState);
      // Normalise field name so routes can rely on playerCount
      if (state.playerCount === undefined && state.participantCount !== undefined) {
        state.playerCount = state.participantCount;
      }
      return { ...state, creator: roomCreator ?? state.creator };
    }

    const cached = await this.redis.get(`pool:${sid}`);
    if (cached) {
      const state = JSON.parse(cached);
      return { ...state, creator: roomCreator ?? state.creator };
    }

    const onChain = await this.contract.pools(poolId);
    const state = parseOnChain(onChain, roomCreator);

    await this.redis.set(`pool:${sid}`, JSON.stringify(state));
    return state;
  }

  async getPlayerInPool(poolId, playerAddress) {
    const sid = safeId(poolId);
    const players = await this.redis.hGetAll(`room:${sid}:players`);
    if (players[playerAddress]) {
      return JSON.parse(players[playerAddress]);
    }
    return null;
  }

  async addPlayerToPool(poolId, playerAddress) {
    const sid = safeId(poolId);

    // Merge with any existing record — EventListener may have already written
    // the verified on-chain stack from the DepositMade event.
    const existing = await this.redis.hGet(`room:${sid}:players`, playerAddress);
    const base = existing ? JSON.parse(existing) : {};

    const player = {
      ...base,
      address: playerAddress,
      joinedAt: base.joinedAt || Date.now(),
      // Preserve 'active' if EventListener already confirmed the deposit; otherwise 'pending'
      status: base.status === 'active' ? 'active' : 'pending',
    };

    await this.redis.hSet(
      `room:${sid}:players`,
      playerAddress,
      JSON.stringify(player)
    );

    const playerCount = await this.redis.hLen(`room:${sid}:players`);
    return playerCount;
  }

  async getPoolPlayers(poolId) {
    const sid = safeId(poolId);
    const players = await this.redis.hGetAll(`room:${sid}:players`);
    return Object.entries(players).map(([addr, raw]) => {
      const p = JSON.parse(raw);
      // Hash key is the canonical address — include it if the value omits it
      if (!p.address) p.address = addr;
      return p;
    });
  }

  async getAllPools() {
    // Serve from cache if fresh
    if (this._allPoolsCache && Date.now() - this._allPoolsCache.at < this._ALL_POOLS_TTL) {
      return this._allPoolsCache.ids;
    }

    // SCAN for candidate IDs (non-blocking, unlike KEYS)
    const ids = new Set();
    await Promise.all([
      this._scan('room:*:state', k => { const m = k.match(/room:(\d+):state/); if (m) ids.add(m[1]); }),
      this._scan('pool:[0-9]*',   k => { const m = k.match(/^pool:(\d+)$/);     if (m) ids.add(m[1]); }),
    ]);

    // Filter out CLOSED pools and delete their stale keys so they stop accumulating
    const activeIds = [];
    await Promise.all([...ids].map(async (id) => {
      const sid = safeId(id);
      let status = 'ACTIVE';
      try {
        const raw = await this.redis.hGet(`room:${sid}:state`, 'data');
        if (raw) {
          status = JSON.parse(raw).status ?? 'ACTIVE';
        } else {
          const cached = await this.redis.get(`pool:${sid}`);
          if (cached) status = JSON.parse(cached).status ?? 'ACTIVE';
        }
      } catch {}

      if (status === 'CLOSED') {
        this.deletePoolKeys(id).catch(() => {});
      } else {
        activeIds.push(id);
      }
    }));

    this._allPoolsCache = { ids: activeIds, at: Date.now() };
    return activeIds;
  }

  /** Delete all Redis keys for a pool (call on game end / cancellation). */
  async deletePoolKeys(poolId) {
    const sid = safeId(poolId);
    await this.redis.del([
      `room:${sid}:meta`,
      `room:${sid}:state`,
      `room:${sid}:players`,
      `room:${sid}:abandoned`,
      `pool:${sid}`,
      `pool:${sid}:cancelled`,
    ]);
  }

  /** Cursor-iterate over a key pattern without blocking Redis. */
  async _scan(pattern, onKey) {
    let cursor = 0;
    do {
      const reply = await this.redis.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = reply.cursor;
      reply.keys.forEach(onKey);
    } while (cursor !== 0);
  }

  /** Invalidate the pool-list cache (call when a new pool is created/closed). */
  invalidatePoolsCache() {
    this._allPoolsCache = null;
  }

  async syncPoolFromChain(poolId) {
    const sid = safeId(poolId);
    const meta = await this.redis.hGetAll(`room:${sid}:meta`);
    const roomCreator = meta?.creator || null;

    const onChain = await this.contract.pools(poolId);
    const state = parseOnChain(onChain, roomCreator);

    await this.redis.set(`pool:${sid}`, JSON.stringify(state));
    return state;
  }
}
